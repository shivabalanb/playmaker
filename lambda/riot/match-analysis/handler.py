import json
import os
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

import boto3
import urllib3
from botocore.exceptions import ClientError

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Initialize AWS clients
ssm_client = boto3.client("ssm")
s3_client = boto3.client("s3")
http = urllib3.PoolManager()


def get_from_s3(bucket_name: str, key: str) -> Dict[str, Any]:
    """Read data from S3."""
    try:
        response = s3_client.get_object(Bucket=bucket_name, Key=key)
        json_body = response["Body"].read().decode("utf-8")
        return json.loads(json_body)
    except ClientError as e:
        raise Exception(f"Failed to read from S3: {str(e)}")


def s3_object_exists(bucket_name: str, key: str) -> bool:
    """Check if an object exists in S3."""
    try:
        s3_client.head_object(Bucket=bucket_name, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def get_riot_api_key() -> str:
    """Get Riot API key from SSM Parameter Store."""
    parameter_name = os.environ.get("RIOT_API_KEY_SSM_PARAM", "/playmaker/riot-api-key")

    try:
        response = ssm_client.get_parameter(Name=parameter_name, WithDecryption=True)
        return response["Parameter"]["Value"]
    except ClientError:
        raise Exception("Failed to retrieve Riot API key from SSM")


def fetch_with_retry(
    url: str, headers: Dict[str, str], retries: int = 3
) -> Dict[str, Any]:
    """Fetch from Riot API with retry logic for rate limiting."""
    for i in range(retries):
        try:
            response = http.request("GET", url, headers=headers, timeout=30)

            if response.status == 429 and i < retries - 1:
                retry_after = response.headers.get("Retry-After")
                wait_time = (
                    int(retry_after) + 0.1 if retry_after else min(2 * (2**i), 30)
                )
                time.sleep(wait_time)
                continue

            if response.status == 200:
                return json.loads(response.data.decode("utf-8"))
            else:
                raise Exception(f"API returned status {response.status}")

        except Exception:
            if i == retries - 1:
                raise
            time.sleep(1)

    raise Exception("Max retries exceeded")


def fetch_timeline_data(match_id: str, region: str) -> Dict[str, Any]:
    """Fetch timeline data from S3 cache or Riot API."""

    # Fetch from Riot API
    api_key = get_riot_api_key()
    headers = {"X-Riot-Token": api_key}
    timeline_url = (
        f"https://{region}.api.riotgames.com/"
        f"lol/match/v5/matches/{match_id}/timeline"
    )

    return fetch_with_retry(timeline_url, headers)


def fetch_match_data(
    match_id: str, region: str = None
) -> Dict[str, Any]:
    # Fetch from Riot API
    api_key = get_riot_api_key()
    headers = {"X-Riot-Token": api_key}
    match_url = (
        f"https://{region}.api.riotgames.com/" f"lol/match/v5/matches/{match_id}"
    )

    return fetch_with_retry(match_url, headers)


def format_timestamp(ms: int) -> str:
    """Convert milliseconds to MM:SS format."""
    total_seconds = ms // 1000
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:02d}"


def get_champion_name(champion_id: int) -> str:
    """Map champion ID to name. For now, return ID as string."""
    # TODO: Implement champion ID to name mapping
    return f"Champion_{champion_id}"


def get_item_name(item_id: int) -> str:
    """Map item ID to name. For now, return ID as string."""
    # TODO: Implement item ID to name mapping
    return f"Item_{item_id}"


def get_rune_name(rune_id: int) -> str:
    """Map rune ID to name. For now, return ID as string."""
    # TODO: Implement rune ID to name mapping
    return f"Rune_{rune_id}"


def extract_draft_info(match_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract draft phase information (bans and picks)."""
    info = match_data.get("info", {})
    participants = info.get("teams", [])

    # Extract bans
    blue_bans = []
    red_bans = []

    for team in participants:
        bans = team.get("bans", [])
        team_id = team.get("teamId", 100)

        for ban in bans:
            champion_id = ban.get("championId", 0)
            if team_id == 100:
                blue_bans.append(champion_id)
            else:
                red_bans.append(champion_id)

    # Extract picks with runes
    blue_picks = []
    red_picks = []

    match_participants = info.get("participants", [])
    for participant in match_participants:
        team_id = participant.get("teamId", 100)
        champion_id = participant.get("championId", 0)
        champion_name = participant.get("championName", get_champion_name(champion_id))
        team_position = participant.get("teamPosition", "")
        puuid = participant.get("puuid", "")

        # Extract runes
        perks = participant.get("perks", {})
        stat_perks = perks.get("statPerks", {})
        styles = perks.get("styles", [])

        primary_style = None
        secondary_style = None

        for style in styles:
            style_id = style.get("style", 0)
            if primary_style is None:
                primary_style = style_id
            elif secondary_style is None:
                secondary_style = style_id

        pick_info = {
            "championId": champion_id,
            "championName": champion_name,
            "teamPosition": team_position,
            "puuid": puuid,
            "primaryRuneStyle": primary_style,
            "secondaryRuneStyle": secondary_style,
        }

        if team_id == 100:
            blue_picks.append(pick_info)
        else:
            red_picks.append(pick_info)

    return {
        "blueBans": blue_bans,
        "redBans": red_bans,
        "bluePicks": blue_picks,
        "redPicks": red_picks,
    }


def extract_final_stats(
    match_data: Dict[str, Any], target_puuid: str
) -> Dict[str, Any]:
    """Extract final stats for all players, highlighting target player."""
    info = match_data.get("info", {})
    participants = info.get("participants", [])

    players = []
    target_player = None

    for participant in participants:
        puuid = participant.get("puuid", "")
        champion_name = participant.get("championName", "Unknown")
        team_position = participant.get("teamPosition", "")
        team_id = participant.get("teamId", 100)

        # Extract items (non-zero only)
        items = [
            participant.get("item0", 0),
            participant.get("item1", 0),
            participant.get("item2", 0),
            participant.get("item3", 0),
            participant.get("item4", 0),
            participant.get("item5", 0),
        ]
        items = [item for item in items if item > 0]

        # Extract runes
        perks = participant.get("perks", {})
        styles = perks.get("styles", [])
        runes_info = []

        for style in styles:
            style_id = style.get("style", 0)
            selections = style.get("selections", [])
            for selection in selections:
                perk_id = selection.get("perk", 0)
                runes_info.append({"style": style_id, "perk": perk_id})

        player_info = {
            "puuid": puuid,
            "championName": champion_name,
            "teamPosition": team_position,
            "teamId": team_id,
            "kills": participant.get("kills", 0),
            "deaths": participant.get("deaths", 0),
            "assists": participant.get("assists", 0),
            "cs": participant.get("totalMinionsKilled", 0)
            + participant.get("neutralMinionsKilled", 0),
            "gold": participant.get("goldEarned", 0),
            "items": items,
            "runes": runes_info,
            "totalDamageToChampions": participant.get("totalDamageDealtToChampions", 0),
            "totalDamageToStructures": participant.get("damageDealtToTurrets", 0),
        }

        players.append(player_info)

        if puuid == target_puuid:
            target_player = player_info

    return {"players": players, "targetPlayer": target_player}


def extract_timeline_events(
    timeline_data: Dict[str, Any], target_puuid: str, match_data: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Extract key events from timeline (kills, objectives, turrets)."""
    info = timeline_data.get("info", {})
    frames = info.get("frames", [])

    # Create PUUID to participant ID mapping
    metadata = timeline_data.get("metadata", {})
    participant_puuids = metadata.get("participants", [])

    puuid_to_participant_id = {}
    participant_id_to_info = {}

    match_info = match_data.get("info", {})
    match_participants = match_info.get("participants", [])

    for idx, puuid in enumerate(participant_puuids):
        participant_id = idx + 1
        puuid_to_participant_id[puuid] = participant_id

        # Find participant info from match data
        for p in match_participants:
            if p.get("puuid") == puuid:
                participant_id_to_info[participant_id] = {
                    "championName": p.get("championName", "Unknown"),
                    "teamId": p.get("teamId", 100),
                }
                break

    events = []

    for frame in frames:
        frame_events = frame.get("events", [])
        participant_frames = frame.get("participantFrames", {})
        timestamp = frame.get("timestamp", 0)

        for event in frame_events:
            event_type = event.get("type", "")

            # Champion kills
            if event_type == "CHAMPION_KILL":
                killer_id = event.get("killerId", 0)
                victim_id = event.get("victimId", 0)

                # Get assists
                assisting_participant_ids = event.get("assistingParticipantIds", [])

                # Get positions for all participants at this timestamp
                positions = {}
                for pid_str, frame_data in participant_frames.items():
                    pid = int(pid_str)
                    pos = frame_data.get("position", {})
                    if pid in participant_id_to_info:
                        champ_name = participant_id_to_info[pid]["championName"]
                        positions[champ_name] = {
                            "x": pos.get("x", 0),
                            "y": pos.get("y", 0),
                        }

                # Find killer and victim names
                killer_name = "Unknown"
                victim_name = "Unknown"
                killer_team = None
                victim_team = None

                if killer_id in participant_id_to_info:
                    killer_name = participant_id_to_info[killer_id]["championName"]
                    killer_team = participant_id_to_info[killer_id]["teamId"]

                if victim_id in participant_id_to_info:
                    victim_name = participant_id_to_info[victim_id]["championName"]
                    victim_team = participant_id_to_info[victim_id]["teamId"]

                # Get assists
                assists = []
                for assist_id in assisting_participant_ids:
                    if assist_id in participant_id_to_info:
                        assists.append(
                            participant_id_to_info[assist_id]["championName"]
                        )

                # Check if first blood
                is_first_blood = event.get("killType") == "KILL_FIRST_BLOOD"

                events.append(
                    {
                        "timestamp": timestamp,
                        "time": format_timestamp(timestamp),
                        "type": "CHAMPION_KILL",
                        "killerId": killer_id,
                        "killerName": killer_name,
                        "killerTeam": "Blue" if killer_team == 100 else "Red",
                        "victimId": victim_id,
                        "victimName": victim_name,
                        "victimTeam": "Blue" if victim_team == 100 else "Red",
                        "assists": assists,
                        "isFirstBlood": is_first_blood,
                        "positions": positions,
                    }
                )

            # Objectives
            elif event_type in ["ELITE_MONSTER_KILL", "DRAGON_SOUL_GIVEN"]:
                killer_id = event.get("killerId", 0)
                monster_type = event.get("monsterType", "")
                monster_sub_type = event.get("monsterSubType", "")

                # Get positions
                positions = {}
                for pid_str, frame_data in participant_frames.items():
                    pid = int(pid_str)
                    pos = frame_data.get("position", {})
                    if pid in participant_id_to_info:
                        champ_name = participant_id_to_info[pid]["championName"]
                        positions[champ_name] = {
                            "x": pos.get("x", 0),
                            "y": pos.get("y", 0),
                        }

                killer_name = "Unknown"
                killer_team = None
                if killer_id in participant_id_to_info:
                    killer_name = participant_id_to_info[killer_id]["championName"]
                    killer_team = participant_id_to_info[killer_id]["teamId"]

                # Determine monster name
                monster_name = monster_sub_type if monster_sub_type else monster_type
                if not monster_name:
                    if event_type == "DRAGON_SOUL_GIVEN":
                        monster_name = "Dragon Soul"
                    else:
                        monster_name = "Objective"

                events.append(
                    {
                        "timestamp": timestamp,
                        "time": format_timestamp(timestamp),
                        "type": event_type,
                        "monsterType": monster_type,
                        "monsterSubType": monster_sub_type,
                        "monsterName": monster_name,
                        "killerId": killer_id,
                        "killerName": killer_name,
                        "team": "Blue" if killer_team == 100 else "Red",
                        "positions": positions,
                    }
                )

            # Turret and Inhibitor kills
            elif event_type == "BUILDING_KILL":
                building_type = event.get("buildingType", "")
                killer_id = event.get("killerId", 0)
                team_id = event.get("teamId", 100)

                positions = {}
                for pid_str, frame_data in participant_frames.items():
                    pid = int(pid_str)
                    pos = frame_data.get("position", {})
                    if pid in participant_id_to_info:
                        champ_name = participant_id_to_info[pid]["championName"]
                        positions[champ_name] = {
                            "x": pos.get("x", 0),
                            "y": pos.get("y", 0),
                        }

                killer_name = "Unknown"
                if killer_id in participant_id_to_info:
                    killer_name = participant_id_to_info[killer_id]["championName"]

                if building_type == "TOWER_BUILDING":
                    events.append(
                        {
                            "timestamp": timestamp,
                            "time": format_timestamp(timestamp),
                            "type": "TURRET_KILL",
                            "killerId": killer_id,
                            "killerName": killer_name,
                            "team": "Blue" if team_id == 100 else "Red",
                            "laneType": event.get("laneType", ""),
                            "towerType": event.get("towerType", ""),
                            "positions": positions,
                        }
                    )
                elif building_type == "INHIBITOR_BUILDING":
                    events.append(
                        {
                            "timestamp": timestamp,
                            "time": format_timestamp(timestamp),
                            "type": "INHIBITOR_KILL",
                            "killerId": killer_id,
                            "killerName": killer_name,
                            "team": "Blue" if team_id == 100 else "Red",
                            "laneType": event.get("laneType", ""),
                            "positions": positions,
                        }
                    )

    return sorted(events, key=lambda x: x["timestamp"])


def extract_minute_by_minute_stats(
    timeline_data: Dict[str, Any], target_puuid: str, match_data: Dict[str, Any]
) -> Dict[int, List[Dict[str, Any]]]:
    """Extract minute-by-minute stats for all champions."""
    info = timeline_data.get("info", {})
    frames = info.get("frames", [])
    frame_interval = info.get("frameInterval", 60000)  # Usually 60 seconds

    # Create PUUID to participant ID mapping
    metadata = timeline_data.get("metadata", {})
    participant_puuids = metadata.get("participants", [])

    puuid_to_participant_id = {}
    participant_id_to_info = {}

    match_info = match_data.get("info", {})
    match_participants = match_info.get("participants", [])

    for idx, puuid in enumerate(participant_puuids):
        participant_id = idx + 1
        puuid_to_participant_id[puuid] = participant_id

        for p in match_participants:
            if p.get("puuid") == puuid:
                participant_id_to_info[participant_id] = {
                    "championName": p.get("championName", "Unknown"),
                    "teamId": p.get("teamId", 100),
                }
                break

    minute_stats = defaultdict(list)

    for frame in frames:
        timestamp = frame.get("timestamp", 0)
        minute = timestamp // frame_interval

        participant_frames = frame.get("participantFrames", {})

        for pid_str, frame_data in participant_frames.items():
            pid = int(pid_str)

            if pid not in participant_id_to_info:
                continue

            champ_name = participant_id_to_info[pid]["championName"]
            team_id = participant_id_to_info[pid]["teamId"]

            # Extract stats
            champion_stats = frame_data.get("championStats", {})
            position = frame_data.get("position", {})

            # Get items (from current gold and level, we can infer items purchased)
            current_gold = frame_data.get("currentGold", 0)
            total_gold = frame_data.get("totalGold", 0)

            # Extract items from events (would need to track item purchases)
            # For now, just show gold

            stats = {
                "championName": champ_name,
                "team": "Blue" if team_id == 100 else "Red",
                "level": frame_data.get("level", 1),
                "cs": frame_data.get("minionsKilled", 0)
                + frame_data.get("jungleMinionsKilled", 0),
                "gold": total_gold,
                "goldDelta": current_gold,
                "position": {"x": position.get("x", 0), "y": position.get("y", 0)},
            }

            minute_stats[minute].append(stats)

    return dict(minute_stats)


def format_timeline_event_for_llm(event: Dict[str, Any]) -> str:
    """Format a timeline event as a human-readable string."""
    time_str = event.get("time", "00:00")
    event_type = event.get("type", "")

    if event_type == "CHAMPION_KILL":
        killer_name = event.get("killerName", "Unknown")
        victim_name = event.get("victimName", "Unknown")
        killer_team = event.get("killerTeam", "")
        victim_team = event.get("victimTeam", "")
        assists = event.get("assists", [])
        is_first_blood = event.get("isFirstBlood", False)

        assist_str = ""
        if assists:
            assist_str = f" (assists: {', '.join(assists)})"

        first_blood_str = " [FIRST BLOOD]" if is_first_blood else ""

        # Format positions
        positions = event.get("positions", {})
        pos_strs = []
        for champ_name, pos in positions.items():
            pos_strs.append(f"{champ_name} @({pos['x']},{pos['y']})")
        positions_str = " | ".join(pos_strs) if pos_strs else ""

        return f"{time_str} — {killer_team} {killer_name} killed {victim_team} {victim_name}{assist_str}{first_blood_str}\n      positions: {positions_str}"

    elif event_type in ["ELITE_MONSTER_KILL", "DRAGON_SOUL_GIVEN"]:
        team = event.get("team", "Unknown")
        killer_name = event.get("killerName", "Unknown")
        monster_type = event.get("monsterType", "")
        monster_sub_type = event.get("monsterSubType", "")

        monster_name = monster_sub_type if monster_sub_type else monster_type
        if not monster_name:
            if event_type == "DRAGON_SOUL_GIVEN":
                monster_name = "Dragon Soul"
            else:
                monster_name = "Objective"

        positions = event.get("positions", {})
        pos_strs = []
        for champ_name, pos in positions.items():
            pos_strs.append(f"{champ_name} @({pos['x']},{pos['y']})")
        positions_str = " | ".join(pos_strs) if pos_strs else ""

        return f"{time_str} — {team} team secured {monster_name} (by {team} {killer_name})\n      positions: {positions_str}"

    elif event_type == "TURRET_KILL":
        team = event.get("team", "Unknown")
        killer_name = event.get("killerName", "Unknown")
        tower_type = event.get("towerType", "")
        lane_type = event.get("laneType", "")

        tower_name = f"{tower_type} Turret" if tower_type else "Turret"
        if lane_type:
            tower_name = f"{lane_type} {tower_name}"

        positions = event.get("positions", {})
        pos_strs = []
        for champ_name, pos in positions.items():
            pos_strs.append(f"{champ_name} @({pos['x']},{pos['y']})")
        positions_str = " | ".join(pos_strs) if pos_strs else ""

        return f"{time_str} — {team} team destroyed {tower_name} (by {team} {killer_name})\n      positions: {positions_str}"

    elif event_type == "INHIBITOR_KILL":
        team = event.get("team", "Unknown")
        killer_name = event.get("killerName", "Unknown")
        lane_type = event.get("laneType", "")

        inhibitor_name = f"{lane_type} Inhibitor" if lane_type else "Inhibitor"

        positions = event.get("positions", {})
        pos_strs = []
        for champ_name, pos in positions.items():
            pos_strs.append(f"{champ_name} @({pos['x']},{pos['y']})")
        positions_str = " | ".join(pos_strs) if pos_strs else ""

        return f"{time_str} — {team} team destroyed {inhibitor_name} (by {team} {killer_name})\n      positions: {positions_str}"

    return f"{time_str} — {event_type}"


def synthesize_match_analysis(
    match_id: str,
    match_data: Dict[str, Any],
    timeline_data: Dict[str, Any],
    target_puuid: str,
) -> Dict[str, Any]:
    """Synthesize match timeline data into structured format for LLM."""
    info = match_data.get("info", {})
    game_duration = info.get("gameDuration", 0)  # in seconds
    game_duration_minutes = game_duration // 60

    # Extract draft info
    draft = extract_draft_info(match_data)

    # Extract final stats
    final_stats = extract_final_stats(match_data, target_puuid)

    # Extract timeline events
    timeline_events = extract_timeline_events(timeline_data, target_puuid, match_data)

    # Format timeline events for LLM
    formatted_timeline = [
        format_timeline_event_for_llm(event) for event in timeline_events
    ]

    # Extract minute-by-minute stats
    minute_by_minute = extract_minute_by_minute_stats(
        timeline_data, target_puuid, match_data
    )

    # Format minute-by-minute stats
    formatted_minute_stats = {}
    for minute, stats_list in minute_by_minute.items():
        formatted_stats = []
        for stats in stats_list:
            champ_name = stats.get("championName", "Unknown")
            team = stats.get("team", "")
            level = stats.get("level", 1)
            cs = stats.get("cs", 0)
            gold = stats.get("gold", 0)
            gold_delta = stats.get("goldDelta", 0)
            pos = stats.get("position", {})

            # Format items (would need to track item purchases per minute)
            items_str = "[]"  # Placeholder

            formatted_stats.append(
                f"  - {team} {champ_name} — Lvl {level}, CS {cs}, Gold {gold} (+{gold_delta}), Items {items_str} @({pos.get('x', 0)},{pos.get('y', 0)})"
            )
        formatted_minute_stats[minute] = formatted_stats

    return {
        "matchId": match_id,
        "gameDuration": game_duration,
        "gameDurationMinutes": game_duration_minutes,
        "draft": draft,
        "finalStats": final_stats,
        "timeline": formatted_timeline,
        "timelineEvents": timeline_events,  # Keep raw events too
        "minuteByMinute": formatted_minute_stats,
        "minuteByMinuteRaw": minute_by_minute,  # Keep raw data too
        "targetPlayer": final_stats.get("targetPlayer"),
    }


def parse_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse event to extract matchId, region, and puuid."""
    if "body" in event:
        body = (
            json.loads(event["body"])
            if isinstance(event["body"], str)
            else event["body"]
        )
    else:
        body = event

    return {
        "matchId": body.get("matchId"),
        "region": body.get("region", "americas"),
        "puuid": body.get("puuid"),
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler function.
    Synthesizes match timeline data for LLM context.
    Expected event format: {"matchId": "...", "region": "americas", "puuid": "..."}
    """
    try:
        params = parse_event(event)

        if not params["matchId"]:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "matchId is required"}),
            }

        if not params["puuid"]:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "puuid is required"}),
            }

        match_id = params["matchId"]
        region = params.get("region", "americas")
        puuid = params["puuid"]

        # Check S3 cache for synthesized analysis
        bucket_name = os.environ.get("S3_BUCKET_NAME")
        if bucket_name:
            safe_match_id = match_id.replace("/", "_").replace(":", "_")
            cache_key = f"riot/match-analyses/{puuid}/{safe_match_id}-analysis.json"

            if s3_object_exists(bucket_name, cache_key):
                try:
                    cached_data = get_from_s3(bucket_name, cache_key)
                    return {
                        "statusCode": 200,
                        "body": json.dumps(cached_data),
                    }
                except Exception as e:
                    # If cache read fails, continue to recompute
                    print(f"Failed to read cache from S3: {str(e)}")

        # Fetch match and timeline data
        match_data = fetch_match_data(match_id, region)
        timeline_data = fetch_timeline_data(match_id, region)

        # Synthesize analysis
        analysis = synthesize_match_analysis(match_id, match_data, timeline_data, puuid)

        # Save to S3 cache
        if bucket_name:
            try:
                safe_match_id = match_id.replace("/", "_").replace(":", "_")
                key = f"riot/match-analyses/{puuid}/{safe_match_id}-analysis.json"
                s3_client.put_object(
                    Bucket=bucket_name,
                    Key=key,
                    Body=json.dumps(analysis, indent=2).encode("utf-8"),
                    ContentType="application/json",
                )
            except Exception as e:
                print(f"Failed to save analysis to S3: {str(e)}")

        return {
            "statusCode": 200,
            "body": json.dumps(analysis),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
