import json
import os
import time
from collections import defaultdict
from typing import Any, Dict, List

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
    """Read match data from S3."""
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

            # If rate limited (429), check for Retry-After header
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


def fetch_matches_from_api(
    puuid: str, region: str, count: int = 20
) -> List[Dict[str, Any]]:
    """Fetch match IDs and match details from Riot API."""
    api_key = get_riot_api_key()
    headers = {"X-Riot-Token": api_key}
    bucket_name = os.environ.get("S3_BUCKET_NAME")

    # Step 1: Fetch match IDs
    match_ids_url = (
        f"https://{region}.api.riotgames.com/"
        f"lol/match/v5/matches/by-puuid/{puuid}/ids"
        f"?start=0&count={count}"
    )

    match_ids = fetch_with_retry(match_ids_url, headers)

    if not isinstance(match_ids, list):
        raise Exception("Invalid match IDs response")

    # Step 2: Fetch match details (with S3 caching)
    matches = []

    for i, match_id in enumerate(match_ids):
        try:
            # Check S3 cache first
            if bucket_name:
                safe_match_id = match_id.replace("/", "_").replace(":", "_")
                key = f"riot/match-histories/{puuid}/{safe_match_id}-match.json"

                if s3_object_exists(bucket_name, key):
                    match_data = get_from_s3(bucket_name, key)
                    matches.append(match_data)
                    continue

            # Fetch from Riot API
            match_url = (
                f"https://{region}.api.riotgames.com/"
                f"lol/match/v5/matches/{match_id}"
            )

            match_data = fetch_with_retry(match_url, headers)

            # Save to S3 cache
            if bucket_name:
                try:
                    safe_match_id = match_id.replace("/", "_").replace(":", "_")
                    key = f"riot/match-histories/{puuid}/{safe_match_id}-match.json"
                    s3_client.put_object(
                        Bucket=bucket_name,
                        Key=key,
                        Body=json.dumps(match_data, indent=2).encode("utf-8"),
                        ContentType="application/json",
                    )
                except Exception:
                    pass  # Don't fail if S3 save fails

            matches.append(match_data)

            # Small delay between requests
            if i < len(match_ids) - 1:
                time.sleep(0.1)

        except Exception as e:
            print(f"Failed to fetch match {match_id}: {str(e)}")
            continue

    return matches


def parse_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse event to extract PUUID and region."""
    if "body" in event:
        body = (
            json.loads(event["body"])
            if isinstance(event["body"], str)
            else event["body"]
        )
    else:
        body = event

    return {
        "puuid": body.get("puuid"),
        "region": body.get("region", "americas"),
    }


def get_player_data(match: Dict[str, Any], puuid: str) -> Dict[str, Any] | None:
    """Extract player-specific data from match."""
    if not match or "info" not in match or "participants" not in match["info"]:
        return None

    for participant in match["info"]["participants"]:
        if participant.get("puuid") == puuid:
            return participant
    return None


def calculate_kda(kills: int, deaths: int, assists: int) -> float:
    """Calculate KDA ratio."""
    if deaths == 0:
        return float(kills + assists)
    return (kills + assists) / deaths


def aggregate_stats(matches: List[Dict[str, Any]], puuid: str) -> Dict[str, Any]:
    """Aggregate statistics from match data."""
    if not matches:
        return {}

    player_matches = []
    wins = 0
    losses = 0
    total_kills = 0
    total_deaths = 0
    total_assists = 0
    total_gold = 0
    total_cs = 0
    total_damage_dealt = 0
    total_damage_taken = 0
    total_vision_score = 0
    total_wards_placed = 0
    total_wards_destroyed = 0
    total_game_duration = 0
    first_blood_kills = 0
    first_blood_assists = 0
    dragon_kills = 0
    baron_kills = 0
    total_kill_participation = 0
    solo_kills = 0

    # Early game metrics
    total_early_cs = 0  # CS at 10 minutes
    total_early_takedowns = 0
    first_turret_participation = 0

    # Advanced combat metrics
    total_multikills = 0
    total_outnumbered_kills = 0
    total_turret_kills = 0
    total_inhibitor_kills = 0

    # Objective participation (not just kills)
    total_dragon_takedowns = 0
    total_baron_takedowns = 0
    total_rift_herald_takedowns = 0
    total_turret_takedowns = 0
    total_inhibitor_takedowns = 0

    # Vision/Control
    total_control_wards_placed = 0
    total_early_ward_kills = 0  # Wards killed before 20 min

    # Survivability
    total_time_dead = 0
    total_longest_living = 0

    # Utility/Support
    total_heals_on_teammates = 0
    total_shields_on_teammates = 0
    total_effective_heal_shield = 0
    total_cc_time = 0

    # Damage share
    total_damage_share = 0

    champion_stats = defaultdict(
        lambda: {
            "games": 0,
            "wins": 0,
            "kills": 0,
            "deaths": 0,
            "assists": 0,
            "total_gold": 0,
            "total_cs": 0,
            "total_damage": 0,
        }
    )

    role_stats = defaultdict(lambda: {"games": 0, "wins": 0})

    for match in matches:
        player = get_player_data(match, puuid)
        if not player:
            continue

        match_info = match.get("info", {})
        game_duration = match_info.get("gameDuration", 0)  # in seconds

        # Basic stats
        win = player.get("win", False)
        if win:
            wins += 1
        else:
            losses += 1

        kills = player.get("kills", 0)
        deaths = player.get("deaths", 0)
        assists = player.get("assists", 0)
        total_kills += kills
        total_deaths += deaths
        total_assists += assists

        gold_earned = player.get("goldEarned", 0)
        total_gold += gold_earned

        cs = player.get("totalMinionsKilled", 0) + player.get("neutralMinionsKilled", 0)
        total_cs += cs

        damage_dealt = player.get("totalDamageDealtToChampions", 0)
        total_damage_dealt += damage_dealt

        damage_taken = player.get("totalDamageTaken", 0)
        total_damage_taken += damage_taken

        vision_score = player.get("visionScore", 0)
        total_vision_score += vision_score

        wards_placed = player.get("wardsPlaced", 0)
        total_wards_placed += wards_placed

        wards_destroyed = player.get("wardsKilled", 0)
        total_wards_destroyed += wards_destroyed

        if player.get("firstBloodKill", False):
            first_blood_kills += 1
        if player.get("firstBloodAssist", False):
            first_blood_assists += 1

        dragon_kills += player.get("dragonKills", 0)
        baron_kills += player.get("baronKills", 0)

        solo_kills += player.get("soloKills", 0)

        # Kill participation (use challenge value if available, otherwise calculate)
        challenges = player.get("challenges", {})
        if challenges.get("killParticipation") is not None:
            kill_participation = challenges.get("killParticipation", 0)
        else:
            team_kills = sum(
                p.get("kills", 0)
                for p in match_info.get("participants", [])
                if p.get("teamId") == player.get("teamId")
            )
            kill_participation = (kills + assists) / team_kills if team_kills > 0 else 0
        total_kill_participation += kill_participation

        # Early game metrics
        lane_cs_10min = challenges.get("laneMinionsFirst10Minutes", 0)
        jungle_cs_10min = challenges.get("jungleCsBefore10Minutes", 0)
        total_early_cs += lane_cs_10min + jungle_cs_10min
        total_early_takedowns += challenges.get("takedownsFirstXMinutes", 0)

        if player.get("firstTowerKill", False) or player.get("firstTowerAssist", False):
            first_turret_participation += 1

        # Advanced combat metrics
        total_multikills += challenges.get("multikills", 0)
        total_outnumbered_kills += challenges.get("outnumberedKills", 0)
        total_turret_kills += player.get("turretKills", 0)
        total_inhibitor_kills += player.get("inhibitorKills", 0)

        # Objective participation
        total_dragon_takedowns += challenges.get("dragonTakedowns", 0)
        total_baron_takedowns += challenges.get("baronTakedowns", 0)
        total_rift_herald_takedowns += challenges.get("riftHeraldTakedowns", 0)
        total_turret_takedowns += player.get("turretTakedowns", 0)
        total_inhibitor_takedowns += player.get("inhibitorTakedowns", 0)

        # Vision/Control
        total_control_wards_placed += player.get("detectorWardsPlaced", 0)
        total_early_ward_kills += challenges.get("wardTakedownsBefore20M", 0)

        # Survivability
        total_time_dead += player.get("totalTimeSpentDead", 0)
        total_longest_living += player.get("longestTimeSpentLiving", 0)

        # Utility/Support
        total_heals_on_teammates += player.get("totalHealsOnTeammates", 0)
        total_shields_on_teammates += player.get("totalDamageShieldedOnTeammates", 0)
        total_effective_heal_shield += challenges.get("effectiveHealAndShielding", 0)
        total_cc_time += player.get("timeCCingOthers", 0)

        # Damage share
        if challenges.get("teamDamagePercentage") is not None:
            total_damage_share += challenges.get("teamDamagePercentage", 0)

        # Champion stats
        champion_id = player.get("championId")
        champion_name = player.get("championName", f"Champion_{champion_id}")
        champion_stats[champion_name]["games"] += 1
        if win:
            champion_stats[champion_name]["wins"] += 1
        champion_stats[champion_name]["kills"] += kills
        champion_stats[champion_name]["deaths"] += deaths
        champion_stats[champion_name]["assists"] += assists
        champion_stats[champion_name]["total_gold"] += gold_earned
        champion_stats[champion_name]["total_cs"] += cs
        champion_stats[champion_name]["total_damage"] += damage_dealt

        # Role stats (using teamPosition)
        role = player.get("teamPosition", "UNKNOWN")
        if role != "UNKNOWN":
            role_stats[role]["games"] += 1
            if win:
                role_stats[role]["wins"] += 1

        # Game phase analysis (simplified - using timeline if available)
        # For now, we'll use basic match data
        total_game_duration += game_duration

        # Reduced match data for LLM context (with more details)
        match_challenges = player.get("challenges", {})
        match_kill_participation = match_challenges.get("killParticipation")
        if match_kill_participation is None:
            # Calculate if not in challenges
            team_kills = sum(
                p.get("kills", 0)
                for p in match_info.get("participants", [])
                if p.get("teamId") == player.get("teamId")
            )
            match_kill_participation = (
                (kills + assists) / team_kills if team_kills > 0 else 0
            )

        # Get items (non-zero items only)
        items = [
            player.get("item0", 0),
            player.get("item1", 0),
            player.get("item2", 0),
            player.get("item3", 0),
            player.get("item4", 0),
            player.get("item5", 0),
        ]
        items = [item for item in items if item > 0]

        player_matches.append(
            {
                "matchId": match.get("metadata", {}).get("matchId", ""),
                "queueId": match_info.get("queueId", 0),
                "gameCreation": match_info.get("gameCreation", 0),
                "gameDuration": game_duration,
                "champion": champion_name,
                "role": role,
                "teamPosition": player.get("teamPosition", ""),
                "win": win,
                "kills": kills,
                "deaths": deaths,
                "assists": assists,
                "kda": calculate_kda(kills, deaths, assists),
                "killParticipation": match_kill_participation,
                "goldEarned": gold_earned,
                "goldSpent": player.get("goldSpent", 0),
                "cs": cs,
                "csPerMinute": cs / (game_duration / 60) if game_duration > 0 else 0,
                "damageDealt": damage_dealt,
                "damageTaken": damage_taken,
                "damageShare": match_challenges.get("teamDamagePercentage", 0),
                "visionScore": vision_score,
                "wardsPlaced": wards_placed,
                "wardsDestroyed": wards_destroyed,
                "controlWardsPlaced": player.get("detectorWardsPlaced", 0),
                "firstBlood": player.get("firstBloodKill", False)
                or player.get("firstBloodAssist", False),
                "firstTower": player.get("firstTowerKill", False)
                or player.get("firstTowerAssist", False),
                "turretKills": player.get("turretKills", 0),
                "inhibitorKills": player.get("inhibitorKills", 0),
                "dragonKills": player.get("dragonKills", 0),
                "baronKills": player.get("baronKills", 0),
                "soloKills": player.get("soloKills", 0),
                "multikills": match_challenges.get("multikills", 0),
                "timeSpentDead": player.get("totalTimeSpentDead", 0),
                "longestTimeSpentLiving": player.get("longestTimeSpentLiving", 0),
                "items": items,
                "itemsPurchased": player.get("itemsPurchased", 0),
                "championLevel": player.get("champLevel", 0),
                "summoner1Id": player.get("summoner1Id", 0),
                "summoner2Id": player.get("summoner2Id", 0),
            }
        )

    num_matches = len(player_matches)
    if num_matches == 0:
        return {}

    # Calculate aggregated metrics
    win_rate = wins / num_matches if num_matches > 0 else 0
    avg_kills = total_kills / num_matches
    avg_deaths = total_deaths / num_matches
    avg_assists = total_assists / num_matches
    avg_kda = calculate_kda(avg_kills, avg_deaths, avg_assists)

    avg_game_duration = total_game_duration / num_matches
    gold_per_min = (
        (total_gold / num_matches) / (avg_game_duration / 60)
        if avg_game_duration > 0
        else 0
    )
    cs_per_min = (
        (total_cs / num_matches) / (avg_game_duration / 60)
        if avg_game_duration > 0
        else 0
    )
    damage_per_min = (
        (total_damage_dealt / num_matches) / (avg_game_duration / 60)
        if avg_game_duration > 0
        else 0
    )
    vision_per_min = (
        (total_vision_score / num_matches) / (avg_game_duration / 60)
        if avg_game_duration > 0
        else 0
    )

    avg_kill_participation = (
        (total_kill_participation / num_matches) * 100 if num_matches > 0 else 0
    )

    # Calculate additional metrics
    avg_early_cs = total_early_cs / num_matches if num_matches > 0 else 0
    avg_early_takedowns = total_early_takedowns / num_matches if num_matches > 0 else 0
    first_turret_rate = (
        first_turret_participation / num_matches if num_matches > 0 else 0
    )

    avg_multikills = total_multikills / num_matches if num_matches > 0 else 0
    avg_outnumbered_kills = (
        total_outnumbered_kills / num_matches if num_matches > 0 else 0
    )

    avg_dragon_participation = (
        total_dragon_takedowns / num_matches if num_matches > 0 else 0
    )
    avg_baron_participation = (
        total_baron_takedowns / num_matches if num_matches > 0 else 0
    )
    avg_rift_herald_participation = (
        total_rift_herald_takedowns / num_matches if num_matches > 0 else 0
    )
    avg_turret_participation = (
        total_turret_takedowns / num_matches if num_matches > 0 else 0
    )
    avg_inhibitor_participation = (
        total_inhibitor_takedowns / num_matches if num_matches > 0 else 0
    )

    avg_control_wards = (
        total_control_wards_placed / num_matches if num_matches > 0 else 0
    )
    avg_early_ward_kills = (
        total_early_ward_kills / num_matches if num_matches > 0 else 0
    )

    avg_time_dead = total_time_dead / num_matches if num_matches > 0 else 0
    avg_longest_living = total_longest_living / num_matches if num_matches > 0 else 0

    avg_heals_on_teammates = (
        total_heals_on_teammates / num_matches if num_matches > 0 else 0
    )
    avg_shields_on_teammates = (
        total_shields_on_teammates / num_matches if num_matches > 0 else 0
    )
    avg_effective_heal_shield = (
        total_effective_heal_shield / num_matches if num_matches > 0 else 0
    )
    avg_cc_time = total_cc_time / num_matches if num_matches > 0 else 0

    avg_damage_share = (
        (total_damage_share / num_matches) * 100 if num_matches > 0 else 0
    )

    # Champion analysis
    champion_performance = []
    for champ_name, stats in champion_stats.items():
        if stats["games"] >= 3:  # Only include champions with 3+ games
            champ_win_rate = stats["wins"] / stats["games"] if stats["games"] > 0 else 0
            champ_avg_kda = calculate_kda(
                stats["kills"] / stats["games"],
                stats["deaths"] / stats["games"],
                stats["assists"] / stats["games"],
            )
            champion_performance.append(
                {
                    "champion": champ_name,
                    "games": stats["games"],
                    "winRate": champ_win_rate,
                    "avgKDA": champ_avg_kda,
                    "avgGold": stats["total_gold"] / stats["games"],
                    "avgCS": stats["total_cs"] / stats["games"],
                    "avgDamage": stats["total_damage"] / stats["games"],
                }
            )

    # Sort by win rate, then games
    champion_performance.sort(key=lambda x: (x["winRate"], x["games"]), reverse=True)
    best_champion = champion_performance[0] if champion_performance else None

    # Role analysis
    role_performance = []
    for role, stats in role_stats.items():
        if stats["games"] > 0:
            role_win_rate = stats["wins"] / stats["games"]
            role_performance.append(
                {"role": role, "games": stats["games"], "winRate": role_win_rate}
            )

    return {
        "summary": {
            "totalGames": num_matches,
            "wins": wins,
            "losses": losses,
            "winRate": win_rate,
        },
        "performance": {
            "kda": {
                "average": avg_kda,
                "kills": avg_kills,
                "deaths": avg_deaths,
                "assists": avg_assists,
            },
            "gold": {
                "perMinute": gold_per_min,
                "total": total_gold / num_matches,
            },
            "cs": {
                "perMinute": cs_per_min,
                "total": total_cs / num_matches,
            },
            "damage": {
                "dealtPerMinute": damage_per_min,
                "dealtTotal": total_damage_dealt / num_matches,
                "takenTotal": total_damage_taken / num_matches,
                "efficiency": (
                    (total_damage_dealt / total_gold) if total_gold > 0 else 0
                ),
            },
            "killParticipation": avg_kill_participation,
            "damageShare": avg_damage_share,
        },
        "earlyGame": {
            "csAt10Minutes": avg_early_cs,
            "takedownsAt10Minutes": avg_early_takedowns,
            "firstTurretParticipation": first_turret_rate,
        },
        "combat": {
            "multikills": avg_multikills,
            "outnumberedKills": avg_outnumbered_kills,
            "turretKills": total_turret_kills / num_matches if num_matches > 0 else 0,
            "inhibitorKills": (
                total_inhibitor_kills / num_matches if num_matches > 0 else 0
            ),
        },
        "objectives": {
            "firstBlood": {
                "kills": first_blood_kills,
                "assists": first_blood_assists,
                "participation": (first_blood_kills + first_blood_assists)
                / num_matches,
            },
            "dragon": {
                "kills": dragon_kills / num_matches,
                "takedowns": avg_dragon_participation,
            },
            "baron": {
                "kills": baron_kills / num_matches,
                "takedowns": avg_baron_participation,
            },
            "riftHerald": {
                "takedowns": avg_rift_herald_participation,
            },
            "turrets": {
                "kills": total_turret_kills / num_matches if num_matches > 0 else 0,
                "takedowns": avg_turret_participation,
            },
            "inhibitors": {
                "kills": total_inhibitor_kills / num_matches if num_matches > 0 else 0,
                "takedowns": avg_inhibitor_participation,
            },
            "soloKills": solo_kills / num_matches,
        },
        "survivability": {
            "avgTimeDead": avg_time_dead,
            "avgLongestLiving": avg_longest_living,
        },
        "utility": {
            "healsOnTeammates": avg_heals_on_teammates,
            "shieldsOnTeammates": avg_shields_on_teammates,
            "effectiveHealAndShield": avg_effective_heal_shield,
            "ccTime": avg_cc_time,
        },
        "vision": {
            "scorePerMinute": vision_per_min,
            "scoreTotal": total_vision_score / num_matches,
            "wardsPlaced": total_wards_placed / num_matches,
            "wardsDestroyed": total_wards_destroyed / num_matches,
            "controlWardsPlaced": avg_control_wards,
            "earlyWardKills": avg_early_ward_kills,
        },
        "champions": {
            "mostPlayed": sorted(
                champion_performance, key=lambda x: x["games"], reverse=True
            )[:5],
            "bestPerforming": best_champion,
            "all": champion_performance,
            "diversity": len(champion_stats),
        },
        "roles": role_performance,
        "matches": player_matches,  # Reduced match data for LLM context
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler function.
    Fetches last 20 matches and aggregates statistics.
    Expected event format: {"puuid": "...", "region": "americas"}
    """
    try:
        params = parse_event(event)

        if not params["puuid"]:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "puuid is required"}),
            }

        bucket_name = os.environ.get("S3_BUCKET_NAME")
        puuid = params["puuid"]
        region = params.get("region", "americas")

        # Always fetch matches from Riot API
        matches = fetch_matches_from_api(puuid, region, count=20)

        if not matches:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "No matches found for this player"}),
            }

        # Get the latest match ID (most recent match)
        latest_match_id = None
        if matches and len(matches) > 0:
            latest_match_id = matches[0].get("metadata", {}).get("matchId")

        # Check S3 cache first
        if bucket_name and latest_match_id:
            cache_key = f"riot/player-performances/{puuid}/last-20-summary.json"

            if s3_object_exists(bucket_name, cache_key):
                try:
                    cached_data = get_from_s3(bucket_name, cache_key)
                    cached_metadata = cached_data.get("metadata", {})
                    cached_latest_match_id = cached_metadata.get("latestMatchId")

                    # If latest match ID matches, return cached data
                    if cached_latest_match_id == latest_match_id:
                        return {
                            "statusCode": 200,
                            "body": json.dumps(cached_data),
                        }
                except Exception as e:
                    # If cache read fails, continue to recompute
                    print(f"Failed to read cache from S3: {str(e)}")

        # Recompute statistics (either no cache or new match detected)
        stats = aggregate_stats(matches, puuid)

        # Add metadata with latest match ID
        stats["metadata"] = {
            "latestMatchId": latest_match_id,
            "computedAt": int(time.time()),
            "numMatches": len(matches),
        }

        # Save aggregated stats to S3 for caching
        if bucket_name:
            try:
                key = f"riot/player-performances/{puuid}/last-20-summary.json"
                s3_client.put_object(
                    Bucket=bucket_name,
                    Key=key,
                    Body=json.dumps(stats, indent=2).encode("utf-8"),
                    ContentType="application/json",
                )
            except Exception as e:
                print(f"Failed to save stats to S3: {str(e)}")

        return {
            "statusCode": 200,
            "body": json.dumps(stats),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
