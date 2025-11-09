import json
import os
import time
import boto3
import urllib3
from urllib.parse import quote
from datetime import datetime
from botocore.exceptions import ClientError
from typing import List, Dict, Any

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ssm_client = boto3.client('ssm')
s3_client = boto3.client('s3')
http = urllib3.PoolManager()

# --- FEAT MAPPING (Based on user-provided definitions) ---
FEAT_TYPE_MAPPING = {
    0: "Warfare (First 3 Kills)",
    1: "Turret Destruction (First Turret)",
    2: "Monster Slaying (First 3 Objectives)",
}

# Define the threshold that the claiming team hits
FEAT_THRESHOLDS = {
    0: 3,  # Warfare (Champion Kills)
    1: 1,  # Turret Destruction (Turret Kills)
    2: 3,  # Monster Slaying (Epic Monster Kills)
}

# Data Dragon URL for static game data (items, champions)
DDRAGON_HOST = "https://ddragon.leagueoflegends.com"

# --- HELPER FUNCTIONS ---

def get_riot_api_key() -> str:
    """
    Get Riot API key from SSM Parameter Store.
    """
    parameter_name = os.environ.get(
        'RIOT_API_KEY_SSM_PARAM',
        '/playmaker/riot-api-key'
    )
    
    try:
        response = ssm_client.get_parameter(
            Name=parameter_name,
            WithDecryption=True
        )
        return response['Parameter']['Value']
    except ClientError as e:
        print(f'Error fetching API key from SSM: {e}')
        raise Exception('Failed to retrieve Riot API key from SSM')

def fetch_with_retry(url: str, headers: Dict[str, str], retries: int = 3) -> Dict[str, Any]:
    """
    Fetch from Riot API with retry logic for rate limiting (using urllib3).
    """
    for i in range(retries):
        try:
            response = http.request('GET', url, headers=headers, timeout=30)
            
            if response.status == 429 and i < retries - 1:
                retry_after = response.headers.get('Retry-After')
                wait_time = (
                    int(retry_after) + 0.1
                    if retry_after
                    else min(2 * (2 ** i), 30)
                )
                
                print(
                    f'[API] Rate limited (429). '
                    f'Retry after {wait_time}s. Attempt {i + 1}/{retries}'
                )
                
                time.sleep(wait_time)
                continue
            
            if response.status == 200:
                return json.loads(response.data.decode('utf-8'))
            elif response.status == 404:
                error_text = response.data.decode('utf-8')
                raise Exception(f'Match not found (404): {error_text}')
            elif response.status == 403:
                raise Exception('API key expired or invalid (403). Please regenerate in Riot Developer Portal.')
            else:
                error_text = response.data.decode('utf-8')
                raise Exception(f'Riot API error ({response.status}): {error_text}')
                
        except urllib3.exceptions.HTTPError as e:
            if i == retries - 1:
                raise
            print(f'[API] HTTP Error. Retry {i + 1}/{retries}: {e}')
            time.sleep(2 ** i)
        except Exception as e:
            if i == retries - 1:
                raise
            print(f'[API] Request failed. Retry {i + 1}/{retries}: {e}')
            time.sleep(2 ** i)
    
    raise Exception('Max retries exceeded due to rate limiting')

def get_routing_value(region: str) -> str:
    """
    Map platform region to routing value for Riot API.
    """
    routing_map = {
        'na1': 'americas',
        'br1': 'americas',
        'la1': 'americas',
        'la2': 'americas',
        'euw1': 'europe',
        'eun1': 'europe',
        'tr1': 'europe',
        'ru': 'europe',
        'kr': 'asia',
        'jp1': 'asia',
        'oc1': 'sea',
        'ph2': 'sea',
        'sg2': 'sea',
        'th2': 'sea',
        'tw2': 'sea',
        'vn2': 'sea',
        'americas': 'americas',
        'europe': 'europe',
        'asia': 'asia',
        'sea': 'sea'
    }
    return routing_map.get(region.lower(), 'americas')

def get_latest_ddragon_version() -> str:
    """Finds the latest version of LoL from Data Dragon."""
    print("Fetching latest Data Dragon version...")
    url = f"{DDRAGON_HOST}/api/versions.json"
    try:
        response = http.request('GET', url, timeout=30)
        if response.status == 200:
            versions = json.loads(response.data.decode('utf-8'))
            latest_version = versions[0]
            print(f"Latest version found: {latest_version}")
            return latest_version
        else:
            raise Exception(f"Failed to fetch Data Dragon version: {response.status}")
    except Exception as e:
        print(f"Error fetching Data Dragon version: {e}")
        raise

def get_ddragon_static_data(version: str) -> Dict[str, Dict]:
    """Fetches champion and item data from Data Dragon."""
    base_url = f"{DDRAGON_HOST}/cdn/{version}/data/en_US"
    
    try:
        champion_response = http.request('GET', f"{base_url}/champion.json", timeout=30)
        item_response = http.request('GET', f"{base_url}/item.json", timeout=30)
        
        if champion_response.status != 200:
            raise Exception(f"Failed to fetch champion data: {champion_response.status}")
        if item_response.status != 200:
            raise Exception(f"Failed to fetch item data: {item_response.status}")
        
        champion_data = json.loads(champion_response.data.decode('utf-8'))
        item_data = json.loads(item_response.data.decode('utf-8'))
        
        return {"champions": champion_data, "items": item_data}
    except Exception as e:
        print(f"Error fetching Data Dragon static data: {e}")
        raise

def build_mappings(
    match_data: Dict[str, Any], 
    static_data: Dict[str, Dict]
) -> Dict[str, Dict]:
    """
    Creates the necessary ID-to-Name mappings.
    """
    print("Building ID-to-Name mappings...")
    
    # 1. Champion ID -> Champion Name
    champ_id_to_name: Dict[str, str] = {}
    for champ_details in static_data["champions"]["data"].values():
        champ_id_to_name[champ_details["key"]] = champ_details["name"]

    # 2. Item ID -> Item Name
    item_id_to_name: Dict[str, str] = {
        "0": "No Item"  # Handle empty slots
    }
    for item_id, item_details in static_data["items"]["data"].items():
        item_id_to_name[item_id] = item_details["name"]

    # 3. Participant ID -> Champion Name, Role, Team ID
    participant_id_to_champ: Dict[int, str] = {}
    participant_id_to_role: Dict[int, str] = {}
    participant_id_to_team: Dict[int, int] = {}
    
    for participant in match_data["info"]["participants"]:
        participant_id = participant["participantId"]
        champion_id_str = str(participant["championId"])
        
        champion_name = champ_id_to_name.get(champion_id_str, f"UnknownChamp(ID:{champion_id_str})")
        participant_id_to_champ[participant_id] = champion_name
        
        # Get role/position (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)
        role = participant.get("teamPosition", "UNKNOWN")
        participant_id_to_role[participant_id] = role
        
        # Get team ID (100 or 200)
        team_id = participant.get("teamId", 0)
        participant_id_to_team[participant_id] = team_id
        
    print("Mappings built successfully.")
    return {
        "items": item_id_to_name,
        "participants": participant_id_to_champ,
        "roles": participant_id_to_role,
        "teams": participant_id_to_team
    }

def format_timestamp(milliseconds: int) -> str:
    """Converts milliseconds timestamp to a MM:SS string."""
    seconds = milliseconds // 1000
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins:02}:{secs:02}"

def get_team_label(id_value: int, is_participant_id: bool) -> str:
    """
    Gets the team label based on either participant ID (1-10) or team ID (100/200).
    """
    if is_participant_id:
        if id_value == 0:
            return "[NEUTRAL]"
        elif id_value <= 5:
            return "[BLUE TEAM]"
        else:
            return "[RED TEAM]"
    else: # team ID (100 or 200)
        if id_value == 100:
            return "[BLUE TEAM]"
        elif id_value == 200:
            return "[RED TEAM]"
        return "[UNKNOWN TEAM]"

def get_opposite_team_label(team_id: int) -> str:
    """Gets the opposite team's label based on the input team ID (100 or 200)."""
    if team_id == 100:
        return "[RED TEAM]"
    elif team_id == 200:
        return "[BLUE TEAM]"
    return "[UNKNOWN TEAM]"

def format_monster_name(monster_type: str, monster_subtype: str = None) -> str:
    """Formats monster name for display."""
    monster_type_upper = str(monster_type).upper()
    
    # Special handling for HORDE -> GRUBS
    if monster_type_upper == "HORDE":
        return "GRUBS"
    
    if monster_subtype:
        if "DRAGON" in monster_subtype:
            return monster_subtype.replace("_DRAGON", "").title() + " Dragon"
        return monster_subtype.replace("_", " ").title()
    return monster_type.replace("_", " ").title()

def get_game_phase(minutes: float) -> str:
    """Determines game phase based on game time in minutes."""
    if minutes < 15:
        return "EARLY_GAME"
    elif minutes < 25:
        return "MID_GAME"
    else:
        return "LATE_GAME"

def get_game_phase_label(minutes: float) -> str:
    """Returns a human-readable game phase label."""
    if minutes < 15:
        return "EARLY GAME (0-15 minutes)"
    elif minutes < 25:
        return "MID GAME (15-25 minutes)"
    else:
        return "LATE GAME (25+ minutes)"

def process_timeline(
    timeline_data: Dict[str, Any], 
    mappings: Dict[str, Dict]
) -> List[str]:
    """
    Processes all events in the timeline and converts them to readable strings.
    """
    print("Processing timeline events...")
    readable_events: List[str] = []
    
    item_map = mappings["items"]
    participant_map = mappings["participants"]
    role_map = mappings["roles"]
    team_map = mappings["teams"]
    
    # Track objectives and stats over time
    # Objectives: {team_id: {objective_type: count}}
    objectives = {100: {"TURRET": 0, "DRAGON": [], "BARON": 0, "RIFT_HERALD": 0, "GRUBS": 0, "ATAKHAN": 0}, 
                  200: {"TURRET": 0, "DRAGON": [], "BARON": 0, "RIFT_HERALD": 0, "GRUBS": 0, "ATAKHAN": 0}}
    
    # Track claimed feats: {team_id: set of claimed feat_type_ids}
    claimed_feats = {100: set(), 200: set()}
    
    # Historical data for "change in last minute" (60 seconds = 60000 ms)
    history: List[Dict[str, Any]] = []
    
    # Track current game phase for section headers
    current_phase = None
    
    for frame in timeline_data["info"]["frames"]:
        
        # 1. Process Events FIRST (occurred BEFORE the frame timestamp)
        for event in frame["events"]:
            timestamp = format_timestamp(event["timestamp"])
            event_type = event["type"]
            
            # Filter out ITEM_DESTROYED events
            if event_type == "ITEM_DESTROYED" or event_type == "WARD_KILL" or event_type == "SKILL_LEVEL_UP" or event_type == "WARD_PLACED":
                continue

            log_entry = ""
            
            try:
                # --- FEAT_UPDATE Event ---
                if event_type == "FEAT_UPDATE":
                    team_id = event["teamId"]
                    team_label = get_team_label(team_id, is_participant_id=False)
                    feat_type_id = event["featType"]
                    feat_value = event["featValue"]

                    feat_name = FEAT_TYPE_MAPPING.get(feat_type_id, f"UnknownFeat(ID:{feat_type_id})")
                    
                    if feat_value == 1001:
                        # Value of 1001 indicates this team lost the race for the feat.
                        opposite_label = get_opposite_team_label(team_id)
                        opposite_team_id = 200 if team_id == 100 else 100

                        if feat_type_id == 0: # Warfare (Champion Kills)
                            description = "WARFARE"
                        elif feat_type_id == 1: # Turret Destruction (Turret Kills)
                            description = "FIRST TURRET"
                        elif feat_type_id == 2: # Monster Slaying (Epic Monster Kills)
                            description = "MONSTER SLAYING"

                        # Track that the opposite team claimed the feat
                        if opposite_team_id in claimed_feats:
                            claimed_feats[opposite_team_id].add(feat_type_id)
                        
                        log_entry = (
                            f"[{timestamp}] {event_type} {opposite_label}: "
                            f"{opposite_label} HAS CLAIMED THE FEAT OF {description}."
                        )
                    else:
                        # This team is gaining a cumulative count.
                        
                        # Determine if the team is claiming the feat at this exact moment
                        is_claimed = (feat_type_id in FEAT_THRESHOLDS and feat_value == FEAT_THRESHOLDS[feat_type_id])
                        
                        # Track claimed feat
                        if is_claimed and team_id in claimed_feats:
                            claimed_feats[team_id].add(feat_type_id)

                        if feat_type_id == 0: # Warfare (Champion Kills)
                            description = f"CHAMPION KILLS: **{feat_value}**."
                        elif feat_type_id == 1: # Turret Destruction (Turret Kills)
                            description = f"TURRETS DESTROYED: **{feat_value}**."
                        elif feat_type_id == 2: # Monster Slaying (Epic Monster Kills)
                            description = f"EPIC MONSTERS SLAYED: **{feat_value}**."
                        else:
                            description = f"Team count updated to: **{feat_value}**."

                        log_entry = (
                            f"[{timestamp}] {event_type} {team_label}: "
                            f"{description}"
                        )

                # --- Champion Kills ---
                elif event_type == "CHAMPION_KILL":
                    killer_id = event["killerId"]
                    victim_id = event["victimId"]
                    
                    if killer_id != 0:
                        team_label = get_team_label(killer_id, is_participant_id=True)
                    else:
                        team_label = "[RED TEAM]" if victim_id <= 5 else "[BLUE TEAM]"

                    killer = participant_map.get(killer_id, "Minion/Turret")
                    victim = participant_map.get(victim_id, "Unknown Victim")
                    
                    assists = []
                    if "assistingParticipantIds" in event:
                        assists = [participant_map.get(pid, "Unknown") for pid in event["assistingParticipantIds"]]
                    
                    log_entry = f"[{timestamp}] {event_type} {team_label}: {killer} killed {victim}."
                    if assists:
                        log_entry += f" (Assists: {', '.join(assists)})"

                # --- Item Events (PURCHASED, SOLD, UNDO) ---
                elif event_type in ("ITEM_PURCHASED", "ITEM_SOLD", "ITEM_UNDO"):
                    p_id = event["participantId"]
                    team_label = get_team_label(p_id, is_participant_id=True)
                    player = participant_map.get(p_id, "Unknown Player")
                    
                    if event_type == "ITEM_PURCHASED":
                        item_name = item_map.get(str(event["itemId"]), f"UnknownItem(ID:{event['itemId']})")
                        log_entry = f"[{timestamp}] {event_type} {team_label}: {player} purchased {item_name}."
                    
                    elif event_type == "ITEM_SOLD":
                        item_name = item_map.get(str(event["itemId"]), f"UnknownItem(ID:{event['itemId']})")
                        log_entry = f"[{timestamp}] {event_type} {team_label}: {player} sold {item_name}."
                    
                    elif event_type == "ITEM_UNDO":
                        before_item = item_map.get(str(event["beforeId"]), "No Item")
                        after_item = item_map.get(str(event["afterId"]), "No Item")
                        log_entry = f"[{timestamp}] {event_type} {team_label}: {player} undid purchase. (Reverted from {after_item} to {before_item})"

                # --- Building Kills ---
                elif event_type == "BUILDING_KILL":
                    killer_id = event["killerId"]
                    team_destroyed_id = event["teamId"]
                    
                    if killer_id != 0:
                        team_label = get_team_label(killer_id, is_participant_id=True)
                        killer_team_id = team_map.get(killer_id, 0)
                    else:
                        team_label = "[RED TEAM]" if team_destroyed_id == 100 else "[BLUE TEAM]"
                        killer_team_id = 200 if team_destroyed_id == 100 else 100

                    killer = participant_map.get(killer_id, "Minion/Rift Herald")
                    building = event["buildingType"].replace("_BUILDING", "")
                    lane = event["laneType"].replace("_LANE", "")
                    team_destroyed_str = "Blue" if team_destroyed_id == 100 else "Red"
                    
                    # Track turret kills
                    if building == "TOWER_TURRET" or building == "TOWER":
                        if killer_team_id in objectives:
                            objectives[killer_team_id]["TURRET"] += 1
                    
                    log_entry = f"[{timestamp}] {event_type} {team_label}: {killer} destroyed a {team_destroyed_str} {building} in {lane}."
                
                # --- Elite Monster Kills (Dragon, Baron, Herald) ---
                elif event_type == "ELITE_MONSTER_KILL":
                    killer_id = event["killerId"]
                    team_label = get_team_label(killer_id, is_participant_id=True)
                    killer = participant_map.get(killer_id, "Unknown Player")
                    killer_team_id = team_map.get(killer_id, 0)
                    
                    monster_type = event["monsterType"]
                    monster_subtype = event.get("monsterSubType")
                    monster_name = format_monster_name(monster_type, monster_subtype)
                    
                    # Track objectives
                    if killer_team_id in objectives:
                        monster_type_str = str(monster_type).upper()
                        if monster_type_str == "BARON_NASHOR" or "BARON" in monster_type_str:
                            objectives[killer_team_id]["BARON"] += 1
                        elif monster_type_str == "RIFT_HERALD" or "HERALD" in monster_type_str:
                            objectives[killer_team_id]["RIFT_HERALD"] += 1
                        elif monster_type_str == "HORDE":
                            # HORDE is displayed as GRUBS in the log
                            objectives[killer_team_id]["GRUBS"] += 1
                        elif monster_type_str == "ATAKHAN" or "ATAKHAN" in monster_type_str:
                            objectives[killer_team_id]["ATAKHAN"] += 1
                        elif "DRAGON" in monster_type_str or (monster_subtype and "DRAGON" in str(monster_subtype).upper()):
                            objectives[killer_team_id]["DRAGON"].append(monster_name)
                    
                    log_entry = f"[{timestamp}] {event_type} {team_label}: {killer} killed {monster_name}."

                # --- Game End Event ---
                elif event_type == "GAME_END":
                    winner = "Blue Team" if event["winningTeam"] == 100 else "Red Team"
                    log_entry = f"[{timestamp}] {event_type}: Game Over. {winner} wins."

                elif event_type == "LEVEL_UP":
                    p_id = event["participantId"]
                    level= event["level"]
                    team_label = get_team_label(p_id, is_participant_id=True)
                    player = participant_map.get(p_id, "Unknown Player")

                    log_entry = f"[{timestamp}] {event_type} {team_label}: {player} has reached level {level}"

                
                elif event_type == "TURRET_PLATE_DESTROYED":
                    p_id = event["teamId"]
                    laneType = event["laneType"]
                    pos = event["position"]
                    team_label = get_team_label(p_id, is_participant_id=False)
                    player = participant_map.get(p_id, "Unknown Player")

                    log_entry = f"[{timestamp}] {event_type} {team_label}: {team_label} has destroyed a turret plate in {laneType} at {pos}"
                
                # --- Other unhandled events ---
                else:
                    log_entry = f"[{timestamp}] Event: {event_type}"

                if log_entry:
                    readable_events.append(log_entry)
                
            except KeyError as e:
                print(f"Warning: Missing key {e} in event: {event}")
            except Exception as e:
                print(f"Warning: Error processing event {event}: {e}")
        
        # 2. Add Participant Frame Snapshots SECOND (for the exact frame timestamp)
        frame_timestamp_str = format_timestamp(frame["timestamp"])
        frame_timestamp_ms = frame["timestamp"]
        
        # Calculate game phase and add section header if phase changed
        frame_minutes = frame_timestamp_ms / 60000.0
        frame_phase = get_game_phase(frame_minutes)
        
        # Add game phase section header when phase changes
        if current_phase != frame_phase:
            current_phase = frame_phase
            phase_label = get_game_phase_label(frame_minutes)
            readable_events.append(f"\n{'='*80}")
            readable_events.append(f"GAME_PHASE: {frame_phase}")
            readable_events.append(f"PHASE_LABEL: {phase_label}")
            readable_events.append(f"PHASE_START_TIME: {frame_timestamp_str}")
            readable_events.append(f"{'='*80}\n")
        
        readable_events.append(f"\n--- FRAME {frame_timestamp_str} [PHASE: {frame_phase}] ---")
        
        # Collect participant data for differential calculations
        participant_data: Dict[int, Dict[str, Any]] = {}
        lane_totals: Dict[str, Dict[int, Dict[str, int]]] = {
            "TOP": {100: {"gold": 0, "level": 0}, 200: {"gold": 0, "level": 0}},
            "MIDDLE": {100: {"gold": 0, "level": 0}, 200: {"gold": 0, "level": 0}},
            "BOTTOM": {100: {"gold": 0, "level": 0}, 200: {"gold": 0, "level": 0}},
            "JUNGLE": {100: {"gold": 0, "level": 0}, 200: {"gold": 0, "level": 0}},
            "UTILITY": {100: {"gold": 0, "level": 0}, 200: {"gold": 0, "level": 0}}
        }
        team_totals: Dict[int, Dict[str, Any]] = {
            100: {"gold": 0, "level": 0, "turrets": 0, "objectives": [], "claimed_feats": []},
            200: {"gold": 0, "level": 0, "turrets": 0, "objectives": [], "claimed_feats": []}
        }
        
        for p_id_str, p_frame in frame["participantFrames"].items():
            try:
                p_id = int(p_id_str)
                team_label = get_team_label(p_id, is_participant_id=True)
                champ_name = participant_map.get(p_id, f"UnknownPlayer(ID:{p_id})")
                team_id = team_map.get(p_id, 0)
                role = role_map.get(p_id, "UNKNOWN")
                
                stats = p_frame.get("championStats", {})
                current_hp = stats.get("health", 0)
                max_hp = stats.get("healthMax", 0) 
                
                level = p_frame.get("level", 0)
                current_gold = p_frame.get("currentGold", 0)
                total_gold = p_frame.get("totalGold", 0)
                cs = p_frame.get("minionsKilled", 0) + p_frame.get("jungleMinionsKilled", 0)
                xp = p_frame.get("xp", 0)

                log_entry = (
                    f"[{frame_timestamp_str}] [FRAME STATUS] {team_label} {champ_name} | "
                    f"Lvl: {level} | HP: {int(current_hp)}/{int(max_hp)} | "
                    f"Total Gold: {total_gold} (Current: {current_gold}) | CS: {cs} | XP: {xp}" 
                )
                readable_events.append(log_entry)
                
                # Store data for differential calculations
                participant_data[p_id] = {
                    "team_id": team_id,
                    "role": role,
                    "gold": total_gold,
                    "level": level
                }
                
                # Accumulate lane totals
                if role in lane_totals and team_id in lane_totals[role]:
                    lane_totals[role][team_id]["gold"] += total_gold
                    lane_totals[role][team_id]["level"] += level
                
                # Accumulate team totals
                if team_id in team_totals:
                    team_totals[team_id]["gold"] += total_gold
                    team_totals[team_id]["level"] += level
                    
            except Exception as e:
                print(f"Warning: Could not process participant frame {p_id_str}: {e}")
        
        # Update team totals with objectives and claimed feats
        for team_id in [100, 200]:
            if team_id in objectives:
                team_totals[team_id]["turrets"] = objectives[team_id]["TURRET"]
                team_totals[team_id]["objectives"] = []
                if objectives[team_id]["BARON"] > 0:
                    team_totals[team_id]["objectives"].append(f"BARON x{objectives[team_id]['BARON']}")
                if objectives[team_id]["RIFT_HERALD"] > 0:
                    team_totals[team_id]["objectives"].append(f"RIFT_HERALD x{objectives[team_id]['RIFT_HERALD']}")
                if objectives[team_id]["GRUBS"] > 0:
                    team_totals[team_id]["objectives"].append(f"GRUBS x{objectives[team_id]['GRUBS']}")
                if objectives[team_id]["ATAKHAN"] > 0:
                    team_totals[team_id]["objectives"].append(f"ATAKHAN x{objectives[team_id]['ATAKHAN']}")
                for dragon in objectives[team_id]["DRAGON"]:
                    team_totals[team_id]["objectives"].append(dragon)
            
            # Update claimed feats
            if team_id in claimed_feats:
                team_totals[team_id]["claimed_feats"] = []
                for feat_type_id in claimed_feats[team_id]:
                    feat_name = FEAT_TYPE_MAPPING.get(feat_type_id, f"UnknownFeat(ID:{feat_type_id})")
                    team_totals[team_id]["claimed_feats"].append(feat_name)
        
        # Calculate and display lane differentials
        readable_events.append(f"\n[LANE DIFFERENTIALS]")
        for lane in ["TOP", "MIDDLE", "BOTTOM", "JUNGLE"]:
            if lane in lane_totals:
                blue_gold = lane_totals[lane][100]["gold"]
                red_gold = lane_totals[lane][200]["gold"]
                gold_diff = blue_gold - red_gold
                
                blue_level = lane_totals[lane][100]["level"]
                red_level = lane_totals[lane][200]["level"]
                level_diff = blue_level - red_level
                
                if gold_diff > 0:
                    gold_leader = "[BLUE TEAM]"
                elif gold_diff < 0:
                    gold_leader = "[RED TEAM]"
                else:
                    gold_leader = "[TIED]"
                
                if level_diff > 0:
                    level_leader = "[BLUE TEAM]"
                elif level_diff < 0:
                    level_leader = "[RED TEAM]"
                else:
                    level_leader = "[TIED]"
                
                readable_events.append(
                    f"  {lane} | GOLD DIFFERENTIAL: {gold_leader} +{abs(gold_diff)} | "
                    f"LEVEL DIFFERENTIAL: {level_leader} +{abs(level_diff)}"
                )
        
        # Calculate and display team differentials
        readable_events.append(f"\n[TEAM DIFFERENTIALS]")
        blue_gold = team_totals[100]["gold"]
        red_gold = team_totals[200]["gold"]
        gold_diff = blue_gold - red_gold
        if gold_diff > 0:
            gold_leader = "[BLUE TEAM]"
        elif gold_diff < 0:
            gold_leader = "[RED TEAM]"
        else:
            gold_leader = "[TIED]"
        
        blue_level = team_totals[100]["level"]
        red_level = team_totals[200]["level"]
        level_diff = blue_level - red_level
        if level_diff > 0:
            level_leader = "[BLUE TEAM]"
        elif level_diff < 0:
            level_leader = "[RED TEAM]"
        else:
            level_leader = "[TIED]"
        
        blue_turrets = team_totals[100]["turrets"]
        red_turrets = team_totals[200]["turrets"]
        turret_diff = blue_turrets - red_turrets
        if turret_diff > 0:
            turret_leader = "[BLUE TEAM]"
        elif turret_diff < 0:
            turret_leader = "[RED TEAM]"
        else:
            turret_leader = "[TIED]"
        
        readable_events.append(
            f"  GOLD DIFFERENTIAL: {gold_leader} +{abs(gold_diff)}"
        )
        readable_events.append(
            f"  LEVEL DIFFERENTIAL: {level_leader} +{abs(level_diff)}"
        )
        readable_events.append(
            f"  TURRET DIFFERENTIAL: {turret_leader} +{abs(turret_diff)}"
        )
        
        # Claimed Feats display
        blue_feats = team_totals[100]["claimed_feats"]
        red_feats = team_totals[200]["claimed_feats"]
        blue_feat_count = len(blue_feats)
        red_feat_count = len(red_feats)
        
        # Check if a team has claimed 2/3 feats (feats of strength)
        if blue_feat_count >= 2:
            readable_events.append(f"\n  *** [BLUE TEAM] HAS CLAIMED THE FEATS OF STRENGTH! ***")
            readable_events.append(f"  *** [BLUE TEAM] DOMINATES WITH {blue_feat_count}/3 FEATS CLAIMED! ***")
        elif red_feat_count >= 2:
            readable_events.append(f"\n  *** [RED TEAM] HAS CLAIMED THE FEATS OF STRENGTH! ***")
            readable_events.append(f"  *** [RED TEAM] DOMINATES WITH {red_feat_count}/3 FEATS CLAIMED! ***")
        
        # Check for Dragon Soul (4 dragons)
        blue_dragon_count = len(objectives[100]["DRAGON"])
        red_dragon_count = len(objectives[200]["DRAGON"])
        
        if blue_dragon_count >= 4:
            readable_events.append(f"\n  *** [BLUE TEAM] HAS CLAIMED THE DRAGON SOUL! ***")
            readable_events.append(f"  *** [BLUE TEAM] DOMINATES WITH {blue_dragon_count} DRAGONS! ***")
        elif red_dragon_count >= 4:
            readable_events.append(f"\n  *** [RED TEAM] HAS CLAIMED THE DRAGON SOUL! ***")
            readable_events.append(f"  *** [RED TEAM] DOMINATES WITH {red_dragon_count} DRAGONS! ***")
        
        # Display claimed feats
        if blue_feats or red_feats:
            readable_events.append(f"\n  [CLAIMED FEATS]")
            blue_feats_str = ", ".join(blue_feats) if blue_feats else "None"
            red_feats_str = ", ".join(red_feats) if red_feats else "None"
            readable_events.append(f"    [BLUE TEAM] Claimed Feats: {blue_feats_str}")
            readable_events.append(f"    [RED TEAM] Claimed Feats: {red_feats_str}")
        
        # Objective differential
        blue_obj_str = ", ".join(team_totals[100]["objectives"]) if team_totals[100]["objectives"] else "None"
        red_obj_str = ", ".join(team_totals[200]["objectives"]) if team_totals[200]["objectives"] else "None"
        blue_obj_count = len(team_totals[100]["objectives"])
        red_obj_count = len(team_totals[200]["objectives"])
        obj_diff = blue_obj_count - red_obj_count
        if obj_diff > 0:
            obj_leader = "[BLUE TEAM]"
        elif obj_diff < 0:
            obj_leader = "[RED TEAM]"
        else:
            obj_leader = "[TIED]"
        
        readable_events.append(
            f"  OBJECTIVE DIFFERENTIAL: {obj_leader} +{abs(obj_diff)}"
        )
        readable_events.append(f"    [BLUE TEAM] Objectives: {blue_obj_str}")
        readable_events.append(f"    [RED TEAM] Objectives: {red_obj_str}")
        
        # Store current frame data for "change in last minute" calculation
        frame_data = {
            "timestamp": frame_timestamp_ms,
            "lane_totals": lane_totals.copy(),
            "team_totals": {
                100: {k: (v.copy() if isinstance(v, list) else v) for k, v in team_totals[100].items()},
                200: {k: (v.copy() if isinstance(v, list) else v) for k, v in team_totals[200].items()}
            }
        }
        history.append(frame_data)
        
        # Calculate "change in last minute" (60 seconds = 60000 ms)
        one_minute_ago = frame_timestamp_ms - 60000
        readable_events.append(f"\n[CHANGE IN LAST MINUTE]")
        
        # Find frame from 1 minute ago (or closest)
        past_frame_data = None
        for past_frame in reversed(history):
            if past_frame["timestamp"] <= one_minute_ago:
                past_frame_data = past_frame
                break
        
        if past_frame_data:
            # Lane differentials change
            for lane in ["TOP", "MIDDLE", "BOTTOM", "JUNGLE"]:
                if lane in lane_totals and lane in past_frame_data["lane_totals"]:
                    current_blue_gold = lane_totals[lane][100]["gold"]
                    current_red_gold = lane_totals[lane][200]["gold"]
                    current_gold_diff = current_blue_gold - current_red_gold
                    
                    past_blue_gold = past_frame_data["lane_totals"][lane][100]["gold"]
                    past_red_gold = past_frame_data["lane_totals"][lane][200]["gold"]
                    past_gold_diff = past_blue_gold - past_red_gold
                    
                    gold_change = current_gold_diff - past_gold_diff
                    if gold_change > 0:
                        gold_change_leader = "[BLUE TEAM]"
                    elif gold_change < 0:
                        gold_change_leader = "[RED TEAM]"
                    else:
                        gold_change_leader = "[NO CHANGE]"
                    
                    current_blue_level = lane_totals[lane][100]["level"]
                    current_red_level = lane_totals[lane][200]["level"]
                    current_level_diff = current_blue_level - current_red_level
                    
                    past_blue_level = past_frame_data["lane_totals"][lane][100]["level"]
                    past_red_level = past_frame_data["lane_totals"][lane][200]["level"]
                    past_level_diff = past_blue_level - past_red_level
                    
                    level_change = current_level_diff - past_level_diff
                    if level_change > 0:
                        level_change_leader = "[BLUE TEAM]"
                    elif level_change < 0:
                        level_change_leader = "[RED TEAM]"
                    else:
                        level_change_leader = "[NO CHANGE]"
                    
                    readable_events.append(
                        f"  {lane} | GOLD DIFF CHANGE: {gold_change_leader} {gold_change:+.0f} | "
                        f"LEVEL DIFF CHANGE: {level_change_leader} {level_change:+.0f}"
                    )
            
            # Team totals change
            current_team_gold_diff = team_totals[100]["gold"] - team_totals[200]["gold"]
            past_team_gold_diff = past_frame_data["team_totals"][100]["gold"] - past_frame_data["team_totals"][200]["gold"]
            team_gold_change = current_team_gold_diff - past_team_gold_diff
            if team_gold_change > 0:
                team_gold_change_leader = "[BLUE TEAM]"
            elif team_gold_change < 0:
                team_gold_change_leader = "[RED TEAM]"
            else:
                team_gold_change_leader = "[NO CHANGE]"
            
            current_team_level_diff = team_totals[100]["level"] - team_totals[200]["level"]
            past_team_level_diff = past_frame_data["team_totals"][100]["level"] - past_frame_data["team_totals"][200]["level"]
            team_level_change = current_team_level_diff - past_team_level_diff
            if team_level_change > 0:
                team_level_change_leader = "[BLUE TEAM]"
            elif team_level_change < 0:
                team_level_change_leader = "[RED TEAM]"
            else:
                team_level_change_leader = "[NO CHANGE]"
            
            current_team_turret_diff = team_totals[100]["turrets"] - team_totals[200]["turrets"]
            past_team_turret_diff = past_frame_data["team_totals"][100]["turrets"] - past_frame_data["team_totals"][200]["turrets"]
            team_turret_change = current_team_turret_diff - past_team_turret_diff
            if team_turret_change > 0:
                team_turret_change_leader = "[BLUE TEAM]"
            elif team_turret_change < 0:
                team_turret_change_leader = "[RED TEAM]"
            else:
                team_turret_change_leader = "[NO CHANGE]"
            
            current_team_obj_diff = len(team_totals[100]["objectives"]) - len(team_totals[200]["objectives"])
            past_team_obj_diff = len(past_frame_data["team_totals"][100]["objectives"]) - len(past_frame_data["team_totals"][200]["objectives"])
            team_obj_change = current_team_obj_diff - past_team_obj_diff
            if team_obj_change > 0:
                team_obj_change_leader = "[BLUE TEAM]"
            elif team_obj_change < 0:
                team_obj_change_leader = "[RED TEAM]"
            else:
                team_obj_change_leader = "[NO CHANGE]"
            
            readable_events.append(
                f"  TEAM GOLD DIFF CHANGE: {team_gold_change_leader} {team_gold_change:+.0f}"
            )
            readable_events.append(
                f"  TEAM LEVEL DIFF CHANGE: {team_level_change_leader} {team_level_change:+.0f}"
            )
            readable_events.append(
                f"  TEAM TURRET DIFF CHANGE: {team_turret_change_leader} {team_turret_change:+.0f}"
            )
            readable_events.append(
                f"  TEAM OBJECTIVE DIFF CHANGE: {team_obj_change_leader} {team_obj_change:+.0f}"
            )
        else:
            pass

    print("Timeline processing complete.")
    return readable_events

def save_parsed_to_s3(match_id: str, parsed_content: str, region: str) -> Dict[str, str]:
    """
    Save parsed readable timeline to S3 bucket with matchId metadata for filtering.
    """
    bucket_name = os.environ.get('S3_BUCKET_NAME')
    
    if not bucket_name:
        raise ValueError('S3_BUCKET_NAME environment variable not set')
    
    safe_match_id = match_id.replace('/', '_').replace(':', '_')
    key = f'parsed-timelines/{safe_match_id}-parsed.txt'
    
    try:
        s3_client.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=parsed_content.encode('utf-8'),
            ContentType='text/plain',
            Metadata={
                'matchId': match_id,
                'match-id': match_id,  # Also add as lowercase for metadata filtering
                'region': region,
                'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
            }
        )
        
        print(f'Successfully saved parsed timeline to s3://{bucket_name}/{key}')
        
        return {
            'bucket': bucket_name,
            'key': key,
            's3Uri': f's3://{bucket_name}/{key}'
        }
    except ClientError as e:
        print(f'Error saving to S3: {e}')
        raise Exception(f'Failed to save parsed timeline to S3: {str(e)}')

def parse_event(event: Dict[str, Any]) -> tuple[List[str], str]:
    """
    Parse Lambda event to extract match IDs and region.
    Handles API Gateway, EventBridge, and direct invocation.
    """
    match_ids = []
    region = 'americas'
    
    if 'body' in event:
        body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        if 'matchIds' in body and isinstance(body['matchIds'], list):
            match_ids = body['matchIds']
        elif 'matchId' in body:
            match_ids = [body['matchId']]
        region = body.get('region', 'americas')
    
    elif 'matchIds' in event:
        match_ids = event['matchIds'] if isinstance(event['matchIds'], list) else [event['matchIds']]
        region = event.get('region', 'americas')
    
    elif 'matchId' in event:
        match_ids = [event['matchId']]
        region = event.get('region', 'americas')
    
    return match_ids, region

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler function.
    Fetches match timeline data from Riot API, parses it into readable format, and saves to S3.
    Expected event: {"matchId": "KR_7858254806", "region": "asia"}
    or {"matchIds": ["KR_7858254806", "NA1_123456"], "region": "americas"}
    """
    print(f'Event received: {json.dumps(event, default=str)}')
    
    try:
        match_ids, region = parse_event(event)
        
        if not match_ids:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'matchId or matchIds is required',
                    'received': event
                })
            }
        
        api_key = get_riot_api_key()
        print('API key retrieved from SSM')
        
        routing_value = get_routing_value(region)
        print(f'Using routing region: {routing_value} for input region: {region}')
        
        headers = {'X-Riot-Token': api_key}
        results = []
        
        # Get Data Dragon static data once (shared across all matches)
        print('Fetching Data Dragon static data...')
        latest_version = get_latest_ddragon_version()
        static_data = get_ddragon_static_data(latest_version)
        print('Data Dragon static data fetched')
        
        for i, match_id in enumerate(match_ids):
            try:
                print(f'Processing match {i+1}/{len(match_ids)}: {match_id}')
                
                # Fetch match data
                match_url = (
                    f'https://{routing_value}.api.riotgames.com/'
                    f'lol/match/v5/matches/{match_id}'
                )
                print(f'Fetching match data from: {match_url}')
                match_data = fetch_with_retry(match_url, headers)
                print(f'Match data fetched for {match_id}')
                
                # Fetch timeline data
                timeline_url = (
                    f'https://{routing_value}.api.riotgames.com/'
                    f'lol/match/v5/matches/{match_id}/timeline'
                )
                print(f'Fetching timeline from: {timeline_url}')
                timeline_data = fetch_with_retry(timeline_url, headers)
                print(f'Timeline data fetched for {match_id}')
                
                # Build mappings
                mappings = build_mappings(match_data, static_data)
                
                # Process timeline into readable format
                print(f'Parsing timeline for {match_id}...')
                readable_log = process_timeline(timeline_data, mappings)
                parsed_content = '\n'.join(readable_log)
                
                # Save parsed content to S3
                s3_result = save_parsed_to_s3(match_id, parsed_content, routing_value)
                
                results.append({
                    'matchId': match_id,
                    'success': True,
                    's3Location': s3_result,
                    'region': routing_value
                })
                
                if len(match_ids) > 1 and i < len(match_ids) - 1:
                    time.sleep(0.1)
                    
            except Exception as e:
                print(f'Error processing match {match_id}: {str(e)}')
                import traceback
                traceback.print_exc()
                results.append({
                    'matchId': match_id,
                    'success': False,
                    'error': str(e)
                })
        
        success_count = sum(1 for r in results if r['success'])
        failure_count = len(results) - success_count
        
        status_code = 200 if failure_count == 0 else 207
        
        return {
            'statusCode': status_code,
            'body': json.dumps({
                'message': (
                    f'Processed {len(match_ids)} match(es): '
                    f'{success_count} succeeded, {failure_count} failed'
                ),
                'results': results,
                'summary': {
                    'total': len(match_ids),
                    'succeeded': success_count,
                    'failed': failure_count
                }
            })
        }
        
    except Exception as e:
        print(f'Handler error: {str(e)}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Failed to process timeline request',
                'message': str(e)
            })
        }

