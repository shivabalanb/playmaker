import json
import os
import time
from collections import defaultdict
from datetime import datetime
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
# Bedrock region - always use us-east-2
bedrock_region = "us-east-2"
bedrock_client = boto3.client("bedrock-runtime", region_name=bedrock_region)


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

    # Core performance metrics
    wins = 0
    losses = 0
    total_kills = 0
    total_deaths = 0
    total_assists = 0
    total_gold_earned = 0
    total_gold_spent = 0
    total_cs = 0
    total_damage_dealt = 0
    total_damage_to_champions = 0
    total_vision_score = 0
    total_game_duration = 0
    total_bounty_gold = 0

    # Team stats for kill participation calculation
    total_team_kills = 0

    # Personal records
    most_kills = 0
    most_assists = 0
    most_deaths = 0
    most_kills_match_id = None
    most_assists_match_id = None
    most_deaths_match_id = None
    highest_damage = 0
    highest_damage_match_id = None
    highest_damage_champion = None

    # Champion stats with enhanced tracking
    champion_stats = defaultdict(
        lambda: {
            "games": 0,
            "wins": 0,
            "losses": 0,
            "kills": 0,
            "deaths": 0,
            "assists": 0,
            "total_gold_earned": 0,
            "total_gold_spent": 0,
            "total_cs": 0,
            "total_damage": 0,
            "total_game_time": 0,
            "championId": 0,  # Track champion ID
            "roles": defaultdict(int),  # Track role distribution per champion
            "best_game": None,  # Will store best game stats
        }
    )

    # Role stats with KDA
    role_stats = defaultdict(
        lambda: {
            "games": 0,
            "wins": 0,
            "losses": 0,
            "kills": 0,
            "deaths": 0,
            "assists": 0,
        }
    )

    # Vision & objectives
    total_wards_placed = 0
    total_wards_destroyed = 0
    total_control_wards_placed = 0
    total_dragon_takedowns = 0
    total_baron_takedowns = 0
    total_turret_takedowns = 0
    first_turret_count = 0
    epic_monster_steals = 0
    rift_herald_takedowns = 0

    # Fun & unique stats
    pentakills = 0
    quadrakills = 0
    triple_kills = 0
    total_solo_kills = 0
    total_first_blood = 0
    perfect_games = 0  # 0 deaths
    flawless_aces = 0
    total_skillshots_dodged = 0
    total_skillshots_hit = 0
    total_survived_low_hp = 0
    total_pings = 0
    ping_breakdown = defaultdict(int)
    outnumbered_kills = 0
    kills_under_own_turret = 0
    saves_ally_from_death = 0
    survived_three_immobilizes = 0

    # Time-based patterns
    shortest_game = {"matchId": None, "duration": float("inf")}
    longest_game = {"matchId": None, "duration": 0}
    games_by_hour = defaultdict(int)
    games_by_length = {
        "short": {"games": 0, "wins": 0},
        "medium": {"games": 0, "wins": 0},
        "long": {"games": 0, "wins": 0},
    }

    for match in matches:
        player = None
        match_info = match.get("info", {})
        participants = match_info.get("participants", [])

        # Find player
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

        # Basic stats
        kills = player.get("kills", 0)
        deaths = player.get("deaths", 0)
        assists = player.get("assists", 0)
        challenges = player.get("challenges", {})

        total_kills += kills
        total_deaths += deaths
        total_assists += assists

        # Calculate team kills for kill participation
        team_id = player.get("teamId")
        team_kills = 0
        for p in participants:
            if p.get("teamId") == team_id:
                team_kills += p.get("kills", 0)
        total_team_kills += team_kills

        gold_earned = player.get("goldEarned", 0)
        gold_spent = player.get("goldSpent", 0)
        total_gold_earned += gold_earned
        total_gold_spent += gold_spent

        cs = player.get("totalMinionsKilled", 0) + player.get("neutralMinionsKilled", 0)
        total_cs += cs

        damage_to_champions = player.get("totalDamageDealtToChampions", 0)
        total_damage_to_champions += damage_to_champions
        total_damage_dealt += player.get("totalDamageDealt", 0)

        total_vision_score += player.get("visionScore", 0)

        bounty_gold = challenges.get("bountyGold", 0)
        total_bounty_gold += bounty_gold

        game_duration = match_info.get("gameDuration", 0)  # in seconds
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
        if damage_to_champions > highest_damage:
            highest_damage = damage_to_champions
            highest_damage_match_id = match_id
            highest_damage_champion = player.get("championName", "Unknown")

        # Glory moments
        penta = player.get("pentaKills", 0)
        quadra = player.get("quadraKills", 0)
        triple = player.get("tripleKills", 0)
        pentakills += penta
        quadrakills += quadra
        triple_kills += triple

        total_solo_kills += player.get("soloKills", 0)
        if player.get("firstBloodKill", False):
            total_first_blood += 1

        # Perfect games (0 deaths)
        if deaths == 0:
            perfect_games += 1

        # Flawless aces
        flawless_aces += challenges.get("flawlessAces", 0)

        # Epic monster steals
        epic_monster_steals += challenges.get("epicMonsterSteals", 0)

        # Vision stats
        total_wards_placed += player.get("wardsPlaced", 0)
        total_wards_destroyed += player.get("wardsKilled", 0)
        total_control_wards_placed += player.get("detectorWardsPlaced", 0)

        # Objectives
        dragon_takedowns = challenges.get("dragonTakedowns", 0)
        baron_takedowns = challenges.get("baronTakedowns", 0)
        turret_takedowns = challenges.get("turretTakedowns", 0)
        total_dragon_takedowns += dragon_takedowns
        total_baron_takedowns += baron_takedowns
        total_turret_takedowns += turret_takedowns

        if player.get("firstTowerKill", False) or player.get("firstTowerAssist", False):
            first_turret_count += 1

        rift_herald_takedowns += challenges.get("riftHeraldTakedowns", 0)

        # Skill stats
        total_skillshots_dodged += challenges.get("skillshotsDodged", 0)
        total_skillshots_hit += challenges.get("skillshotsHit", 0)
        total_survived_low_hp += challenges.get("survivedSingleDigitHpCount", 0)

        # Communication
        all_pings = (
            player.get("allInPings", 0)
            + player.get("assistMePings", 0)
            + player.get("basicPings", 0)
            + player.get("commandPings", 0)
            + player.get("dangerPings", 0)
            + player.get("enemyMissingPings", 0)
            + player.get("enemyVisionPings", 0)
            + player.get("getBackPings", 0)
            + player.get("holdPings", 0)
            + player.get("needVisionPings", 0)
            + player.get("onMyWayPings", 0)
            + player.get("pushPings", 0)
            + player.get("retreatPings", 0)
            + player.get("visionClearedPings", 0)
        )
        total_pings += all_pings
        ping_breakdown["assistMe"] += player.get("assistMePings", 0)
        ping_breakdown["danger"] += player.get("dangerPings", 0)
        ping_breakdown["onMyWay"] += player.get("onMyWayPings", 0)
        ping_breakdown["enemyMissing"] += player.get("enemyMissingPings", 0)
        ping_breakdown["enemyVision"] += player.get("enemyVisionPings", 0)
        ping_breakdown["getBack"] += player.get("getBackPings", 0)
        ping_breakdown["retreat"] += player.get("retreatPings", 0)
        ping_breakdown["command"] += player.get("commandPings", 0)
        ping_breakdown["allIn"] += player.get("allInPings", 0)

        # Clutch moments
        outnumbered_kills += challenges.get("outnumberedKills", 0)
        kills_under_own_turret += challenges.get("killsUnderOwnTurret", 0)
        saves_ally_from_death += challenges.get("saveAllyFromDeath", 0)
        survived_three_immobilizes += challenges.get(
            "survivedThreeImmobilizesInFight", 0
        )

        # Champion stats
        champion_name = player.get("championName", "Unknown")
        champion_id = player.get("championId", 0)
        # Normalize role; Riot may return "" for some matches - treat as UNKNOWN
        role = player.get("teamPosition") or "UNKNOWN"

        champ_stats = champion_stats[champion_name]
        champ_stats["games"] += 1
        if win:
            champ_stats["wins"] += 1
        else:
            champ_stats["losses"] += 1
        champ_stats["kills"] += kills
        champ_stats["deaths"] += deaths
        champ_stats["assists"] += assists
        champ_stats["total_gold_earned"] += gold_earned
        champ_stats["total_gold_spent"] += gold_spent
        champ_stats["total_cs"] += cs
        champ_stats["total_damage"] += damage_to_champions
        champ_stats["total_game_time"] += game_duration
        champ_stats["championId"] = champion_id  # Store champion ID

        if role != "UNKNOWN":
            champ_stats["roles"][role] += 1

        # Track best game per champion
        game_kda = calculate_kda(kills, deaths, assists)
        if champ_stats["best_game"] is None or (
            damage_to_champions > champ_stats["best_game"]["damage"]
            or (
                damage_to_champions == champ_stats["best_game"]["damage"]
                and game_kda > champ_stats["best_game"]["kda"]
            )
        ):
            champ_stats["best_game"] = {
                "matchId": match_id,
                "kda": game_kda,
                "damage": damage_to_champions,
                "win": win,
            }

        # Role stats
        if role != "UNKNOWN":
            role_stats[role]["games"] += 1
            if win:
                role_stats[role]["wins"] += 1
            else:
                role_stats[role]["losses"] += 1
            role_stats[role]["kills"] += kills
            role_stats[role]["deaths"] += deaths
            role_stats[role]["assists"] += assists

        # Time-based patterns
        game_creation = match_info.get("gameCreation", 0)  # milliseconds
        if game_creation > 0:
            dt = datetime.fromtimestamp(game_creation / 1000)
            hour = dt.hour
            games_by_hour[hour] += 1

        # Game length categories
        game_minutes = game_duration / 60
        if game_minutes < 20:
            length_cat = "short"
        elif game_minutes <= 35:
            length_cat = "medium"
        else:
            length_cat = "long"

        games_by_length[length_cat]["games"] += 1
        if win:
            games_by_length[length_cat]["wins"] += 1

        if game_duration < shortest_game["duration"]:
            shortest_game = {"matchId": match_id, "duration": game_duration}
        if game_duration > longest_game["duration"]:
            longest_game = {"matchId": match_id, "duration": game_duration}

    num_matches = len(matches)
    if num_matches == 0:
        return {}

    # Calculate averages
    avg_game_duration = total_game_duration / num_matches
    avg_gold_per_minute = (
        (total_gold_earned / num_matches) / (avg_game_duration / 60)
        if avg_game_duration > 0
        else 0
    )
    kill_participation = (
        (total_kills + total_assists) / total_team_kills if total_team_kills > 0 else 0
    )

    # Build champion stats
    champion_list = []
    for champ_name, stats in champion_stats.items():
        games = stats["games"]
        if games == 0:
            continue

        win_rate = stats["wins"] / games
        avg_kda = calculate_kda(
            stats["kills"] / games,
            stats["deaths"] / games,
            stats["assists"] / games,
        )

        # Find favorite role for this champion
        favorite_role = (
            max(stats["roles"].items(), key=lambda x: x[1])[0]
            if stats["roles"]
            else "UNKNOWN"
        )

        avg_gold_per_min = (
            stats["total_gold_earned"] / (stats["total_game_time"] / 60)
            if stats["total_game_time"] > 0
            else 0
        )

        champion_list.append(
            {
                "champion": champ_name,
                "championId": stats["championId"],
                "gamesPlayed": games,
                "wins": stats["wins"],
                "losses": stats["losses"],
                "winRate": win_rate,
                "averageKDA": avg_kda,
                "averageDamage": stats["total_damage"] / games,
                "averageGoldPerMin": avg_gold_per_min,
                "favoriteRole": favorite_role,
                "bestGame": stats["best_game"],
                "totalKills": stats["kills"],
                "totalDeaths": stats["deaths"],
                "totalAssists": stats["assists"],
                "totalGameTime": stats["total_game_time"],
            }
        )

    # Sort champions: prioritize win rate, then games played
    # This ensures 0% win rate champions don't dominate the list
    # Use a composite score: win rate is primary, games played is secondary
    # Champions with 0% win rate are pushed to the bottom
    champion_list.sort(
        key=lambda x: (
            x["winRate"] > 0,  # Champions with wins first (excludes 0% win rate)
            x["winRate"],  # Then by win rate (higher is better)
            x["gamesPlayed"],  # Then by games played as tiebreaker
        ),
        reverse=True,
    )
    most_played_champion = champion_list[0]["champion"] if champion_list else None
    # Prepare top-5 strictly by win rate (minimum 5 games to avoid noise)
    top5_by_winrate_pool = [c for c in champion_list if c.get("gamesPlayed", 0) >= 5]
    if len(top5_by_winrate_pool) < 5:
        top5_by_winrate_pool = (
            champion_list  # fall back to full list if too few qualifying
        )
    top5_by_winrate = sorted(
        top5_by_winrate_pool, key=lambda c: c.get("winRate", 0), reverse=True
    )[:5]

    # Champion highlights (most damage avg, most kills, most deaths, most assists)
    most_damage_avg_champion = (
        max(champion_list, key=lambda c: c.get("averageDamage", 0))
        if champion_list
        else None
    )
    most_kills_champion = (
        max(champion_list, key=lambda c: c.get("totalKills", 0))
        if champion_list
        else None
    )
    most_deaths_champion = (
        max(champion_list, key=lambda c: c.get("totalDeaths", 0))
        if champion_list
        else None
    )
    most_assists_champion = (
        max(champion_list, key=lambda c: c.get("totalAssists", 0))
        if champion_list
        else None
    )

    # Build safe highlight objects (avoid subscripting None)
    most_damage_avg_obj = (
        {
            "champion": most_damage_avg_champion.get("champion"),
            "averageDamage": most_damage_avg_champion.get("averageDamage"),
        }
        if isinstance(most_damage_avg_champion, dict)
        else None
    )
    most_kills_obj = (
        {
            "champion": most_kills_champion.get("champion"),
            "totalKills": most_kills_champion.get("totalKills"),
        }
        if isinstance(most_kills_champion, dict)
        else None
    )
    most_deaths_obj = (
        {
            "champion": most_deaths_champion.get("champion"),
            "totalDeaths": most_deaths_champion.get("totalDeaths"),
        }
        if isinstance(most_deaths_champion, dict)
        else None
    )
    most_assists_obj = (
        {
            "champion": most_assists_champion.get("champion"),
            "totalAssists": most_assists_champion.get("totalAssists"),
        }
        if isinstance(most_assists_champion, dict)
        else None
    )

    # Find highest win rate champion (min 5 games)
    high_wr_champs = [c for c in champion_list if c["gamesPlayed"] >= 5]
    highest_wr_champion = (
        max(high_wr_champs, key=lambda x: x["winRate"])["champion"]
        if high_wr_champs
        else None
    )

    # Build role stats
    role_list = []
    # Only include standard positions; exclude blanks/unknowns entirely
    allowed_roles = {"TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"}
    for role, stats in role_stats.items():
        if role not in allowed_roles:
            continue
        if stats["games"] > 0:
            win_rate = stats["wins"] / stats["games"]
            avg_kda = calculate_kda(
                stats["kills"] / stats["games"],
                stats["deaths"] / stats["games"],
                stats["assists"] / stats["games"],
            )
            role_list.append(
                {
                    "role": role,
                    "games": stats["games"],
                    "wins": stats["wins"],
                    "losses": stats["losses"],
                    "winRate": win_rate,
                    "avgKDA": avg_kda,
                }
            )
    role_list.sort(key=lambda x: x["games"], reverse=True)
    favorite_role = role_list[0]["role"] if role_list else None
    best_role = (
        max(role_list, key=lambda x: x["winRate"])["role"] if role_list else None
    )

    # Calculate win rates by game length
    for length_cat in games_by_length:
        games = games_by_length[length_cat]["games"]
        if games > 0:
            games_by_length[length_cat]["winRate"] = (
                games_by_length[length_cat]["wins"] / games
            )
        else:
            games_by_length[length_cat]["winRate"] = 0

    # Skillshot accuracy (approximate - using dodged vs hit)
    skillshot_accuracy = (
        total_skillshots_hit / (total_skillshots_hit + total_skillshots_dodged)
        if (total_skillshots_hit + total_skillshots_dodged) > 0
        else 0
    )

    return {
        # Core performance metrics
        "corePerformance": {
            "totalGames": num_matches,
            "wins": wins,
            "losses": losses,
            "winRate": wins / num_matches if num_matches > 0 else 0,
            "totalGameTime": total_game_duration,
            "averageGameDuration": avg_game_duration,
            "totalKills": total_kills,
            "totalDeaths": total_deaths,
            "totalAssists": total_assists,
            "averageKDA": calculate_kda(
                total_kills / num_matches,
                total_deaths / num_matches,
                total_assists / num_matches,
            ),
            "killParticipation": kill_participation,
            "totalDamageDealt": total_damage_dealt,
            "totalDamageToChampions": total_damage_to_champions,
            "averageDamagePerGame": total_damage_to_champions / num_matches,
            "highestDamageGame": {
                "matchId": highest_damage_match_id,
                "damage": highest_damage,
                "champion": highest_damage_champion,
            },
            "totalGoldEarned": total_gold_earned,
            "totalGoldSpent": total_gold_spent,
            "averageGoldPerMinute": avg_gold_per_minute,
            "totalBountyGold": total_bounty_gold,
        },
        # Champion-specific stats
        "championStats": {
            "champions": {c["champion"]: c for c in champion_list},
            "mostPlayedChampion": most_played_champion,
            "highestWinRateChampion": highest_wr_champion,
            "championDiversity": len(champion_stats),
            "top5ByWinRate": top5_by_winrate,
            "mostDamageAvgChampion": most_damage_avg_obj,
            "mostKillsChampion": most_kills_obj,
            "mostDeathsChampion": most_deaths_obj,
            "mostAssistsChampion": most_assists_obj,
        },
        # Role/position stats
        "roleStats": {
            "roles": {r["role"]: r for r in role_list},
        "favoriteRole": favorite_role,
            "bestRole": best_role,
        },
        # Vision & objectives
        "vision": {
            "totalVisionScore": total_vision_score,
            "averageVisionScore": total_vision_score / num_matches,
            "totalWardsPlaced": total_wards_placed,
            "totalWardsDestroyed": total_wards_destroyed,
            "totalControlWardsPlaced": total_control_wards_placed,
            "visionScorePerMinute": (
                (total_vision_score / num_matches) / (avg_game_duration / 60)
                if avg_game_duration > 0
                else 0
            ),
        },
        "objectives": {
            "totalDragonTakedowns": total_dragon_takedowns,
            "totalBaronTakedowns": total_baron_takedowns,
            "totalTurretTakedowns": total_turret_takedowns,
            "firstTurretRate": first_turret_count / num_matches,
            "epicMonsterSteals": epic_monster_steals,
            "riftHeraldTakedowns": rift_herald_takedowns,
        },
        # Fun & unique stats
        "achievements": {
            "pentakills": pentakills,
            "quadrakills": quadrakills,
            "tripleKills": triple_kills,
            "soloKills": total_solo_kills,
            "firstBloods": total_first_blood,
            "perfectGames": perfect_games,
            "flawlessAces": flawless_aces,
            "epicMonsterSteals": epic_monster_steals,
        },
        "skillStats": {
            "totalSkillshotsDodged": total_skillshots_dodged,
            "totalSkillshotsHit": total_skillshots_hit,
            "skillshotAccuracy": skillshot_accuracy,
            "survivedLowHP": total_survived_low_hp,
        },
        "communication": {
            "totalPings": total_pings,
            "pingBreakdown": dict(ping_breakdown),
            "averagePingsPerGame": total_pings / num_matches,
        },
        "clutchMoments": {
            "outnumberedKills": outnumbered_kills,
            "killsUnderOwnTurret": kills_under_own_turret,
            "savesAllyFromDeath": saves_ally_from_death,
            "survivedThreeImmobilizes": survived_three_immobilizes,
        },
        # Time-based patterns
        "timePatterns": {
            "averageGameLength": avg_game_duration,
            "shortestGame": shortest_game,
            "longestGame": longest_game,
            "gamesByTimeOfDay": dict(games_by_hour),
            "winRateByGameLength": games_by_length,
        },
        # Legacy format for backward compatibility
        "summary": {
            "totalGames": num_matches,
            "wins": wins,
            "losses": losses,
            "winRate": wins / num_matches if num_matches > 0 else 0,
        },
        "favoriteChampion": champion_list[0] if champion_list else None,
        "top5Champions": champion_list[:5],
        "favoriteRole": {"role": favorite_role} if favorite_role else None,
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
        "playstyle": {
            "avgSoloKills": total_solo_kills / num_matches,
            "avgMultikills": (pentakills * 5 + quadrakills * 4 + triple_kills * 3)
            / num_matches,
            "firstBloodRate": total_first_blood / num_matches,
            "avgDragonKills": total_dragon_takedowns / num_matches,
            "avgBaronKills": total_baron_takedowns / num_matches,
            "avgTurretKills": total_turret_takedowns / num_matches,
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
            "avgGold": total_gold_earned / num_matches,
            "avgCS": total_cs / num_matches,
            "avgDamage": total_damage_to_champions / num_matches,
            "avgVisionScore": total_vision_score / num_matches,
        },
        "champions": {
            "totalUnique": len(champion_stats),
            "all": champion_list,
        },
    }


def generate_match_summaries(
    matches: List[Dict[str, Any]], puuid: str
) -> List[Dict[str, Any]]:
    """Generate per-match summaries for trend analysis."""
    summaries = []

    for match in matches:
        player = None
        match_info = match.get("info", {})
        participants = match_info.get("participants", [])

        for p in participants:
            if p.get("puuid") == puuid:
                player = p
                break

        if not player:
            continue

        match_id = match.get("metadata", {}).get("matchId", "")
        challenges = player.get("challenges", {})

        # Determine performance level
        kills = player.get("kills", 0)
        deaths = player.get("deaths", 0)
        assists = player.get("assists", 0)
        kda = calculate_kda(kills, deaths, assists)
        damage = player.get("totalDamageDealtToChampions", 0)
        game_duration = match_info.get("gameDuration", 1)
        avg_damage = (
            damage / (game_duration / 60) if game_duration > 0 else 0
        )  # per minute

        performance = "average"
        if kda > 3.0 and damage > 20000:
            performance = "carry"
        elif kda < 1.0 or deaths > 8:
            performance = "feed"
        elif assists > 10 and damage < 15000:
            performance = "support"

        # Key moments
        key_moments = []
        if player.get("firstBloodKill", False):
            key_moments.append("firstBlood")
        if player.get("pentaKills", 0) > 0:
            key_moments.append("pentakill")
        if player.get("quadraKills", 0) > 0:
            key_moments.append("quadrakill")
        if challenges.get("epicMonsterSteals", 0) > 0:
            key_moments.append("epicSteal")
        if deaths == 0:
            key_moments.append("perfectGame")
        if challenges.get("flawlessAces", 0) > 0:
            key_moments.append("flawlessAce")
        if challenges.get("outnumberedKills", 0) > 0:
            key_moments.append("outnumberedKill")
        if challenges.get("saveAllyFromDeath", 0) > 0:
            key_moments.append("saveAlly")

        summaries.append(
            {
                "matchId": match_id,
                "date": match_info.get("gameCreation", 0),
                "champion": player.get("championName", "Unknown"),
                "role": player.get("teamPosition", "UNKNOWN"),
                "win": player.get("win", False),
                "kda": kda,
                "kills": kills,
                "deaths": deaths,
                "assists": assists,
                "damage": damage,
                "damagePerMinute": avg_damage,
                "goldEarned": player.get("goldEarned", 0),
                "visionScore": player.get("visionScore", 0),
                "gameDuration": game_duration,
                "keyMoments": key_moments,
                "performance": performance,
            }
        )

    return summaries


def analyze_trends(summaries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze trends from match summaries."""
    if not summaries:
        return {}

    # Sort by date (most recent first)
    summaries_sorted = sorted(summaries, key=lambda x: x["date"], reverse=True)

    # Win/loss streaks
    if not summaries_sorted:
        return {}

    current_streak = {
        "type": summaries_sorted[0]["win"],
        "length": 1,
        "start": summaries_sorted[0]["matchId"],
    }
    streaks = []

    for i in range(1, len(summaries_sorted)):
        if summaries_sorted[i]["win"] == current_streak["type"]:
            current_streak["length"] += 1
        else:
            streaks.append(current_streak)
            current_streak = {
                "type": summaries_sorted[i]["win"],
                "length": 1,
                "start": summaries_sorted[i]["matchId"],
            }
    streaks.append(current_streak)

    # Performance over time
    recent_10 = summaries_sorted[:10]
    recent_20 = summaries_sorted[:20]
    first_50 = (
        summaries_sorted[-50:] if len(summaries_sorted) >= 50 else summaries_sorted
    )
    last_50 = summaries_sorted[:50] if len(summaries_sorted) >= 50 else summaries_sorted

    def calc_avg_stats(matches):
        if not matches:
            return {}
        wins = sum(1 for m in matches if m["win"])
        return {
            "games": len(matches),
            "wins": wins,
            "winRate": wins / len(matches) if matches else 0,
            "avgKDA": sum(m["kda"] for m in matches) / len(matches) if matches else 0,
            "avgDamage": (
                sum(m["damage"] for m in matches) / len(matches) if matches else 0
            ),
            "avgDamagePerMinute": (
                sum(m["damagePerMinute"] for m in matches) / len(matches)
                if matches
                else 0
            ),
        }

    win_streaks = [s for s in streaks if s["type"]]
    loss_streaks = [s for s in streaks if not s["type"]]

    return {
        "winStreaks": win_streaks,
        "lossStreaks": loss_streaks,
        "longestWinStreak": (
            max(win_streaks, key=lambda x: x["length"])
            if win_streaks
            else {"length": 0, "start": None, "type": True}
        ),
        "longestLossStreak": (
            max(loss_streaks, key=lambda x: x["length"])
            if loss_streaks
            else {"length": 0, "start": None, "type": False}
        ),
        "currentStreak": current_streak,
        "performanceOverTime": {
            "recent10Games": calc_avg_stats(recent_10),
            "recent20Games": calc_avg_stats(recent_20),
            "first50Games": calc_avg_stats(first_50),
            "last50Games": calc_avg_stats(last_50),
        },
    }


def generate_ai_insights_with_bedrock(stats: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AI insights using AWS Bedrock Claude 3 Haiku.
    Falls back to rule-based insights if Bedrock fails.
    """
    try:
        # Prepare context - only essential data to save tokens
        # Focus on challenges and achievements, remove trends
        context = {
            "summary": stats.get("summary", {}),
            "corePerformance": {
                "winRate": stats.get("corePerformance", {}).get("winRate"),
                "averageKDA": stats.get("corePerformance", {}).get("averageKDA"),
                "killParticipation": stats.get("corePerformance", {}).get(
                    "killParticipation"
                ),
                "averageDamagePerGame": stats.get("corePerformance", {}).get(
                    "averageDamagePerGame"
                ),
                "totalGames": stats.get("corePerformance", {}).get("totalGames"),
            },
            "championStats": {
                "mostPlayedChampion": stats.get("championStats", {}).get(
                    "mostPlayedChampion"
                ),
                "highestWinRateChampion": stats.get("championStats", {}).get(
                    "highestWinRateChampion"
                ),
                "championDiversity": stats.get("championStats", {}).get(
                    "championDiversity"
                ),
            },
            "roleStats": stats.get("roleStats", {}),
            "achievements": stats.get("achievements", {}),
            "skillStats": stats.get("skillStats", {}),
            "clutchMoments": stats.get("clutchMoments", {}),
            "objectives": stats.get("objectives", {}),
        }

        prompt = f"""You are creating a HYPE, DRAMATIC, and ENERGETIC League of Legends season recap! This is a celebration of the player's achievements - make it exciting, fun, and full of energy! Write everything in second person (use "you" and "your").Keep senctences short and punchy, feeel free touse like not full sentences, phrases like you are talking to them directly. The theme is league of legends esports, glory, honor, gaming, fun,reflective, lookback.

Player Data:
{json.dumps(context, indent=2)}

Generate insights in this exact JSON format (no markdown, just JSON):
{{
    "overview": "A CINEMATIC, REFLECTIVE 2-3 sentence opening that feels like a trailer voiceover — dramatic yet grounded, evocative, and purposeful. Celebrate their achievements with measured energy and vivid imagery; avoid shouty hype. Think esports documentary intro rather than stadium announcer.",
    "strengths": ["Medium-length hype phrase (8–14 words) like 'Dominated mid lane with a commanding 59% win rate!'", "Another medium-length strength about clutch feats, epic steals, or perfect games", "Third medium-length strength highlighting resilience, objective control, or skill mastery"],
    "funFacts": ["WHIMSICAL, DRAMATIC fun fact 1 about challenges/achievements/corePerformance/personalRecords/matchSummaries/corePerformance", "FUNNY, GOOFY fun fact 2 about challenges/achievements/corePerformance/personalRecords/matchSummaries/corePerformance", "SAD, DRAMATIC fun fact 3 about challenges/achievements/corePerformance/personalRecords/matchSummaries/corePerformance", "Tuff, nonchalant, RANDOM fun fact 4 about challenges/achievements/corePerformance/personalRecords/matchSummaries/corePerformance", "WHIMSICAL, DRAMATIC fun fact 5 about challenges/achievements/corePerformance/personalRecords/matchSummaries/corePerformance"],
    "clutchMomentsInsight": "Craft a short, cinematic 1-2 sentence insight that celebrates defining plays. Blend clutchMoments with highlights from achievements and skillStats (perfect games, flawless aces, epic steals, skillshots, etc.) so it doesn't read like a stat list. Keep it punchy, triumphant, and varied.",
    "playstyle": "3-5 sentence description of their playstyle written to them using 'you' and 'your'. Make it energetic and reference their challenge achievements! Capture their Signature Identity (e.g., macro shot-caller, late-game closer, split-push threat) based on roles, damage profile, and highlight moments. Describe their Tempo & Rhythm — how they pace games, whether they snowball early or scale patiently, their average game length, objective control, and comeback success.",
    "improvements": ["recommendation 1 for you", "recommendation 2 for you", "recommendation 3 for you". Make it actionable, personal actually useful for their next league game use can keep in mind, with encouragement],
    "poem": "A dramatic, epic 4-6 line poem celebrating their season with honor and glory. Channel the energy of League of Legends esports - speak of battles, victories, legendary moments, and mastery. Reference their achievements and playstyle but focus on the epic narrative and warrior's journey rather than listing specific numbers. Use evocative language about honor, glory, conquest, and becoming a legend. Make it feel like a champion's tale - personable, inspiring, and full of gaming/esports energy. Use simple rhyme scheme."
}}

CRITICAL GUIDELINES:
- OVERVIEW: Write with a CINEMATIC and PROFOUND tone — like a trailer narrator. Use evocative imagery and restrained intensity; celebrate their achievements without over-the-top hype. Aim for reflective, grounded drama that pulls the reader in.
- FUN FACTS: Generate 3-5 WHIMSICAL, SPONTANEOUS, and DRAMATIC fun facts that FOCUS HEAVILY ON CHALLENGES from the achievements, skillStats, and clutchMoments data. Examples: perfect games, pentakills, epic steals, skillshot dodges, outnumbered kills, saves, etc. Write them like excited reactions, NOT statements! Use questions, exclamations, and dramatic language. Examples: "WOW, 15 games without dying - how did you do that?????" or "15 PERFECT GAMES?! Are you even human???" or "You dodged HOW many skillshots?! That's INSANE!" Avoid starting with "You" or "Your" - make them feel spontaneous and amazed! Use lots of question marks and exclamation points! FUN FACTS are the ONLY exception to the second-person rule - they should feel like amazed reactions!
- CLUTCH MOMENTS INSIGHT: Deliver a short, cinematic highlight callout (1-2 sentences). Blend clutchMoments with standout achievements and skillStats for variety—think perfect games, flawless aces, epic steals, clutch escapes, skillshots, etc. Make it feel like an esports documentary voiceover: triumphant, vivid, and not just a restatement of the numbers. Keep it energetic without shouting.
- STRENGTHS: Generate 3 MEDIUM-LENGTH (8–14 words), PUNCHY, insightful, high-level phrases (not paragraphs). Think quick hype commentary with context, not single-word blurts. Examples: "You ruled mid lane with a ruthless 59% win rate this season!", "Clutch under pressure—epic steals and flawless aces turned games on their head!", "Survived relentless CC and still carried fights with surgical focus!" Focus on challenge achievements (pentakills, perfect games, epic steals, clutch moments, skillshot accuracy, etc.). Use exclamation points! Make them feel like spirited, celebratory shouts.
- NO TRENDS: Do NOT reference win streaks, loss streaks, recent performance, or any time-based trends. Focus purely on aggregate achievements and challenges.
- Write everything EXCEPT fun facts in second person (you/your) - this is a personal recap talking directly to the player
- Reference specific numbers from the data, especially challenge achievements
- Be encouraging, exciting, and celebratory - this is a HYPE recap!
- Make it feel personal and energetic, like you're their biggest fan celebrating their season
- STRENGTHS and WEAKNESSES should be SHORT PHRASES, not sentences - quick, punchy, fun!
- POEM: Write a dramatic, epic 4-6 line poem that feels like a warrior's legend or champion's tale. Focus on honor, glory, battles, and mastery. Reference achievements and playstyle but weave them into an epic narrative - avoid listing too many specific numbers. Make it personable, inspiring, and full of League of Legends esports energy. Think dramatic storytelling, not stat recitation!

Return ONLY valid JSON, no markdown formatting."""

        # Use model ID (same format as test_bedrock.py)
        model_id = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"

        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}],
        }

        response = bedrock_client.invoke_model(modelId=model_id, body=json.dumps(body))

        response_body = json.loads(response["body"].read())
        ai_content = response_body["content"][0]["text"].strip()

        # Clean up JSON if wrapped in markdown
        if "```json" in ai_content:
            ai_content = ai_content.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_content:
            ai_content = ai_content.split("```")[1].split("```")[0].strip()

        insights = json.loads(ai_content)
        print("[DEBUG] Bedrock insights generated successfully")
    return insights

    except Exception as e:
        print(f"[ERROR] Bedrock failed: {str(e)}")
        # Re-raise to fail the handler
        raise


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

        # 3. Generate match summaries for trend analysis
        print("[DEBUG] Generating match summaries...")
        match_summaries = generate_match_summaries(matches, puuid)

        # 4. Analyze trends from match summaries
        print("[DEBUG] Analyzing trends...")
        trends = analyze_trends(match_summaries)

        # Add match summaries and trends to stats
        stats["matchSummaries"] = match_summaries
        stats["trends"] = trends

        # 5. Generate AI insights using Bedrock
        print("[DEBUG] Generating insights with Bedrock...")
        insights = generate_ai_insights_with_bedrock(stats)

        # 6. Combine into recap data
        recap_data = {
            "puuid": puuid,
            "stats": stats,
            "insights": insights,
            "generatedAt": int(time.time()),
            "numMatches": len(matches),
            "latestMatchId": latest_match_id,
        }

        # 7. Save to S3 (only PUUID-based cache, no jobId files)
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
