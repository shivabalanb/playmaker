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
                error_body = ""
                try:
                    error_body = response.data.decode("utf-8") if response.data else ""
                except:
                    pass
                error_msg = f"API returned status {response.status}"
                if error_body:
                    error_msg += f": {error_body}"
                raise Exception(error_msg)

        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(1)

    raise Exception("Max retries exceeded")


def fetch_matches_from_api(
    puuid: str, region: str, count: int = 100
) -> List[Dict[str, Any]]:
    """Fetch match IDs and match details from Riot API."""
    from urllib.parse import quote

    api_key = get_riot_api_key()
    headers = {"X-Riot-Token": api_key}
    encoded_puuid = quote(puuid, safe="-_.!~*'()")

    # Fetch match IDs
    match_ids_url = (
        f"https://{region}.api.riotgames.com/"
        f"lol/match/v5/matches/by-puuid/{encoded_puuid}/ids"
        f"?start=0&count={count}"
    )

    match_ids = fetch_with_retry(match_ids_url, headers)

    if not isinstance(match_ids, list):
        raise Exception("Invalid match IDs response")

    # Fetch match details
    matches = []
    for i, match_id in enumerate(match_ids):
        try:
            match_url = (
                f"https://{region}.api.riotgames.com/"
                f"lol/match/v5/matches/{match_id}"
            )
            match_data = fetch_with_retry(match_url, headers)
            matches.append(match_data)

            if i < len(match_ids) - 1:
                time.sleep(0.1)

        except Exception as e:
            print(f"Failed to fetch match {match_id}: {str(e)}")
            continue

    return matches


def calculate_kda(kills: int, deaths: int, assists: int) -> float:
    """Calculate KDA ratio."""
    if deaths == 0:
        return float(kills + assists)
    return (kills + assists) / deaths


def aggregate_season_stats(matches: List[Dict[str, Any]], puuid: str) -> Dict[str, Any]:
    """Aggregate statistics from last 100 matches for season recap."""
    if not matches:
        return {}

    wins = 0
    losses = 0
    total_kills = 0
    total_deaths = 0
    total_assists = 0
    total_gold = 0
    total_cs = 0
    total_damage_dealt = 0
    total_vision_score = 0
    total_game_duration = 0

    # Personal records
    most_kills = 0
    most_assists = 0
    most_deaths = 0
    most_kills_match_id = None
    most_assists_match_id = None
    most_deaths_match_id = None

    # Glory moments
    pentakills = 0
    quadrakills = 0
    triple_kills = 0

    # Champion stats
    champion_stats = defaultdict(
        lambda: {
            "games": 0,
            "wins": 0,
            "losses": 0,
            "kills": 0,
            "deaths": 0,
            "assists": 0,
            "total_gold": 0,
            "total_cs": 0,
            "total_damage": 0,
        }
    )

    # Role stats
    role_stats = defaultdict(lambda: {"games": 0, "wins": 0, "losses": 0})

    # Playstyle metrics
    total_solo_kills = 0
    total_multikills = 0
    total_first_blood = 0
    total_dragon_kills = 0
    total_baron_kills = 0
    total_turret_kills = 0

    for match in matches:
        player = None
        match_info = match.get("info", {})
        participants = match_info.get("participants", [])

        for participant in participants:
            if participant.get("puuid") == puuid:
                player = participant
                break

        if not player:
            continue

        match_id = match.get("metadata", {}).get("matchId", "")
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
        total_gold += player.get("goldEarned", 0)
        total_cs += player.get("totalMinionsKilled", 0) + player.get(
            "neutralMinionsKilled", 0
        )
        total_damage_dealt += player.get("totalDamageDealtToChampions", 0)
        total_vision_score += player.get("visionScore", 0)

        game_duration = match_info.get("gameDuration", 0)
        total_game_duration += game_duration

        # Personal records
        if kills > most_kills:
            most_kills = kills
            most_kills_match_id = match_id
        if assists > most_assists:
            most_assists = assists
            most_assists_match_id = match_id
        if deaths > most_deaths:
            most_deaths = deaths
            most_deaths_match_id = match_id

        # Glory moments (check challenges for multikills)
        challenges = player.get("challenges", {})
        multikills = challenges.get("multikills", 0)
        if multikills >= 5:
            pentakills += 1
        elif multikills >= 4:
            quadrakills += 1
        elif multikills >= 3:
            triple_kills += 1

        total_multikills += multikills
        total_solo_kills += player.get("soloKills", 0)
        if player.get("firstBloodKill", False):
            total_first_blood += 1
        total_dragon_kills += player.get("dragonKills", 0)
        total_baron_kills += player.get("baronKills", 0)
        total_turret_kills += player.get("turretKills", 0)

        # Champion stats
        champion_name = player.get("championName", "Unknown")
        champion_stats[champion_name]["games"] += 1
        if win:
            champion_stats[champion_name]["wins"] += 1
        else:
            champion_stats[champion_name]["losses"] += 1
        champion_stats[champion_name]["kills"] += kills
        champion_stats[champion_name]["deaths"] += deaths
        champion_stats[champion_name]["assists"] += assists
        champion_stats[champion_name]["total_gold"] += player.get("goldEarned", 0)
        champion_stats[champion_name]["total_cs"] += player.get(
            "totalMinionsKilled", 0
        ) + player.get("neutralMinionsKilled", 0)
        champion_stats[champion_name]["total_damage"] += player.get(
            "totalDamageDealtToChampions", 0
        )

        # Role stats
        role = player.get("teamPosition", "UNKNOWN")
        if role != "UNKNOWN":
            role_stats[role]["games"] += 1
            if win:
                role_stats[role]["wins"] += 1
            else:
                role_stats[role]["losses"] += 1

    num_matches = len(matches)
    if num_matches == 0:
        return {}

    # Calculate top 5 champions
    champion_list = []
    for champ_name, stats in champion_stats.items():
        win_rate = stats["wins"] / stats["games"] if stats["games"] > 0 else 0
        avg_kda = calculate_kda(
            stats["kills"] / stats["games"],
            stats["deaths"] / stats["games"],
            stats["assists"] / stats["games"],
        )
        champion_list.append(
            {
                "champion": champ_name,
                "games": stats["games"],
                "wins": stats["wins"],
                "losses": stats["losses"],
                "winRate": win_rate,
                "avgKDA": avg_kda,
                "avgGold": stats["total_gold"] / stats["games"],
                "avgCS": stats["total_cs"] / stats["games"],
                "avgDamage": stats["total_damage"] / stats["games"],
            }
        )

    # Sort by games played
    champion_list.sort(key=lambda x: x["games"], reverse=True)
    top_5_champions = champion_list[:5]
    favorite_champion = top_5_champions[0] if top_5_champions else None

    # Calculate role distribution
    role_list = []
    for role, stats in role_stats.items():
        if stats["games"] > 0:
            win_rate = stats["wins"] / stats["games"]
            role_list.append(
                {
                    "role": role,
                    "games": stats["games"],
                    "wins": stats["wins"],
                    "losses": stats["losses"],
                    "winRate": win_rate,
                }
            )
    role_list.sort(key=lambda x: x["games"], reverse=True)
    favorite_role = role_list[0] if role_list else None

    # Calculate playstyle metrics
    avg_solo_kills = total_solo_kills / num_matches
    avg_multikills = total_multikills / num_matches
    first_blood_rate = total_first_blood / num_matches

    return {
        "summary": {
            "totalGames": num_matches,
            "wins": wins,
            "losses": losses,
            "winRate": wins / num_matches if num_matches > 0 else 0,
        },
        "favoriteChampion": favorite_champion,
        "top5Champions": top_5_champions,
        "favoriteRole": favorite_role,
        "roleDistribution": role_list,
        "personalRecords": {
            "mostKills": {
                "value": most_kills,
                "matchId": most_kills_match_id,
            },
            "mostAssists": {
                "value": most_assists,
                "matchId": most_assists_match_id,
            },
            "mostDeaths": {
                "value": most_deaths,
                "matchId": most_deaths_match_id,
            },
        },
        "gloryMoments": {
            "pentakills": pentakills,
            "quadrakills": quadrakills,
            "tripleKills": triple_kills,
        },
        "playstyle": {
            "avgSoloKills": avg_solo_kills,
            "avgMultikills": avg_multikills,
            "firstBloodRate": first_blood_rate,
            "avgDragonKills": total_dragon_kills / num_matches,
            "avgBaronKills": total_baron_kills / num_matches,
            "avgTurretKills": total_turret_kills / num_matches,
        },
        "performance": {
            "avgKills": total_kills / num_matches,
            "avgDeaths": total_deaths / num_matches,
            "avgAssists": total_assists / num_matches,
            "avgKDA": calculate_kda(
                total_kills / num_matches,
                total_deaths / num_matches,
                total_assists / num_matches,
            ),
            "avgGold": total_gold / num_matches,
            "avgCS": total_cs / num_matches,
            "avgDamage": total_damage_dealt / num_matches,
            "avgVisionScore": total_vision_score / num_matches,
        },
        "champions": {
            "totalUnique": len(champion_stats),
            "all": champion_list,
        },
    }


def generate_ai_insights(stats: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AI insights based on aggregated stats.
    Analyzes playstyle, strengths, weaknesses, and recommendations.
    """
    summary = stats.get("summary", {})
    favorite_champion = stats.get("favoriteChampion")
    favorite_role = stats.get("favoriteRole")
    playstyle = stats.get("playstyle", {})
    performance = stats.get("performance", {})
    glory_moments = stats.get("gloryMoments", {})

    win_rate = summary.get("winRate", 0)
    total_games = summary.get("totalGames", 0)

    insights = {
        "overview": f"Played {total_games} games with a {win_rate*100:.1f}% win rate",
        "favoriteChampion": None,
        "playstyle": None,
        "strengths": [],
        "weaknesses": [],
        "recommendations": [],
    }

    # Favorite champion insight
    if favorite_champion:
        champ_name = favorite_champion.get("champion", "Unknown")
        champ_games = favorite_champion.get("games", 0)
        champ_win_rate = favorite_champion.get("winRate", 0)
        insights["favoriteChampion"] = {
            "champion": champ_name,
            "games": champ_games,
            "winRate": champ_win_rate,
            "insight": f"{champ_name} was your most played champion with {champ_games} games and a {champ_win_rate*100:.1f}% win rate",
        }

    # Playstyle analysis
    avg_solo_kills = playstyle.get("avgSoloKills", 0)
    first_blood_rate = playstyle.get("firstBloodRate", 0)
    avg_multikills = playstyle.get("avgMultikills", 0)

    playstyle_type = "Balanced"
    if avg_solo_kills > 1.0:
        playstyle_type = "Aggressive"
    elif first_blood_rate > 0.3:
        playstyle_type = "Early Game Focused"
    elif avg_multikills > 0.5:
        playstyle_type = "Teamfight Oriented"

    insights["playstyle"] = {
        "type": playstyle_type,
        "description": f"You have an {playstyle_type.lower()} playstyle",
        "metrics": {
            "soloKills": avg_solo_kills,
            "firstBloodRate": first_blood_rate,
            "multikills": avg_multikills,
        },
    }

    # Strengths
    if win_rate > 0.55:
        insights["strengths"].append("Strong win rate indicates good decision making")
    if avg_solo_kills > 1.0:
        insights["strengths"].append("High solo kill potential shows mechanical skill")
    if first_blood_rate > 0.25:
        insights["strengths"].append("Strong early game presence")
    if glory_moments.get("pentakills", 0) > 0:
        insights["strengths"].append(
            f"Achieved {glory_moments.get('pentakills')} pentakill(s) - exceptional teamfight performance"
        )

    # Weaknesses
    if win_rate < 0.45:
        insights["weaknesses"].append(
            "Win rate below 50% - consider reviewing gameplay"
        )
    avg_deaths = performance.get("avgDeaths", 0)
    if avg_deaths > 6:
        insights["weaknesses"].append(
            "High average deaths - work on positioning and map awareness"
        )
    if first_blood_rate < 0.1:
        insights["weaknesses"].append(
            "Low first blood participation - improve early game impact"
        )

    # Recommendations
    if win_rate < 0.5:
        insights["recommendations"].append(
            "Focus on improving win rate through better decision making"
        )
    if avg_deaths > 6:
        insights["recommendations"].append(
            "Reduce deaths by improving positioning and map awareness"
        )
    if favorite_role and favorite_role.get("winRate", 0) < 0.45:
        role_name = favorite_role.get("role", "role")
        insights["recommendations"].append(
            f"Consider trying different roles - {role_name} has a low win rate"
        )

    return insights


def parse_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse event to extract parameters."""
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


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler function.
    Processes season recap asynchronously.
    Expected event format: {"puuid": "...", "region": "..."}
    """
    from urllib.parse import quote

    bucket_name = os.environ.get("S3_BUCKET_NAME")
    processing_key = None

    try:
        params = parse_event(event)

        if not params["puuid"]:
            raise Exception("puuid is required")

        puuid = params["puuid"]
        region = params.get("region", "americas")
        # URL encode PUUID for S3 key to match Next.js route
        encoded_puuid = quote(puuid, safe="-_.!~*'()")
        processing_key = f"riot/season-recaps/{encoded_puuid}-processing.json"

        # Check if already processing (race condition check)
        if bucket_name and s3_object_exists(bucket_name, processing_key):
            print("[DEBUG] Processing marker already exists, skipping...")
            return {
                "statusCode": 200,
                "body": json.dumps({"status": "already_processing"}),
            }

        # Create processing marker (Lambda has write access)
        if bucket_name:
            processing_data = {
                "puuid": puuid,
                "region": region,
                "startedAt": int(time.time() * 1000),  # milliseconds for consistency
            }
            try:
                s3_client.put_object(
                    Bucket=bucket_name,
                    Key=processing_key,
                    Body=json.dumps(processing_data).encode("utf-8"),
                    ContentType="application/json",
                )
                print(f"[DEBUG] Created processing marker: {processing_key}")
            except Exception as e:
                print(f"[WARNING] Failed to create processing marker: {e}")
                # Continue anyway - marker is just for status checking

        # 1. Fetch last 100 matches
        print("[DEBUG] Fetching matches...")
        matches = fetch_matches_from_api(puuid, region, count=100)

        if not matches:
            raise Exception("No matches found")

        if len(matches) < 10:
            raise Exception(f"Need at least 10 matches. Found {len(matches)} matches.")

        # Get latest match ID for cache comparison
        latest_match_id = None
        if matches:
            latest_match_id = matches[0].get("metadata", {}).get("matchId")

        # 2. Aggregate stats from all matches
        print(f"[DEBUG] Aggregating stats from {len(matches)} matches...")
        stats = aggregate_season_stats(matches, puuid)

        # 3. Generate AI insights
        print(f"[DEBUG] Generating insights...")
        insights = generate_ai_insights(stats)

        # 4. Combine into recap data
        recap_data = {
            "puuid": puuid,
            "stats": stats,
            "insights": insights,
            "generatedAt": int(time.time()),
            "numMatches": len(matches),
            "latestMatchId": latest_match_id,
        }

        # 5. Save to S3 (only PUUID-based cache, no jobId files)
        if bucket_name:
            # Use encoded PUUID to match Next.js route
            cache_key = f"riot/season-recaps/{encoded_puuid}-latest.json"
            s3_client.put_object(
                Bucket=bucket_name,
                Key=cache_key,
                Body=json.dumps(recap_data, indent=2).encode("utf-8"),
                ContentType="application/json",
            )

            # Delete processing marker after successful save
            if processing_key:
                try:
                    s3_client.delete_object(Bucket=bucket_name, Key=processing_key)
                except Exception as e:
                    print(f"Warning: Failed to delete processing marker: {e}")

        return {
            "statusCode": 200,
            "body": json.dumps({"status": "complete"}),
        }

    except Exception as e:
        # Delete processing marker on error
        if bucket_name and processing_key:
            try:
                s3_client.delete_object(Bucket=bucket_name, Key=processing_key)
            except:
                pass

        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
