"""
League of Legends Season Recap Comparison Generator
Generates fun, competitive comparison insights between two players
"""

import os
import json
import boto3
from typing import Dict, Any

# Configuration
REGION = os.environ.get("AWS_REGION", "us-east-2")
S3_BUCKET = os.environ.get("S3_BUCKET_NAME", "playmaker-rift-rewind")
BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"

s3_client = boto3.client('s3', region_name=REGION)
bedrock_client = boto3.client('bedrock-runtime', region_name=REGION)


def fetch_recap_from_s3(puuid: str) -> Dict[str, Any]:
    """Fetch a player's recap from S3"""
    key = f"riot/season-recaps/{puuid}-latest.json"
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(response['Body'].read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching recap for {puuid}: {str(e)}")
        raise


def generate_comparison_insights(player1_data: Dict, player2_data: Dict, 
                                 player1_name: str, player2_name: str) -> Dict[str, Any]:
    """Generate fun, competitive comparison insights using Bedrock"""
    
    # Extract comprehensive stats
    p1_stats = player1_data.get('stats', {})
    p2_stats = player2_data.get('stats', {})
    
    p1_core = p1_stats.get('corePerformance', {})
    p2_core = p2_stats.get('corePerformance', {})
    
    p1_champ = p1_stats.get('championStats', {})
    p2_champ = p2_stats.get('championStats', {})
    
    p1_clutch = p1_stats.get('clutchMoments', {})
    p2_clutch = p2_stats.get('clutchMoments', {})
    
    p1_comm = p1_stats.get('communication', {})
    p2_comm = p2_stats.get('communication', {})
    
    # Build comparison prompt
    prompt = f"""You are creating a FUN, SPICY comparison between two League of Legends players.

CRITICAL: Use ACTUAL player names in ALL text:
- Player 1: {player1_name}
- Player 2: {player2_name}

PLAYER 1 ({player1_name}) STATS:
- Win Rate: {p1_core.get('winRate', 0)*100:.1f}% | Games: {p1_core.get('totalGames', 0)}
- KDA: {p1_core.get('averageKDA', 0):.2f} | Kill Participation: {p1_core.get('killParticipation', 0)*100:.1f}%
- Damage/Game: {p1_core.get('averageDamagePerGame', 0):,.0f} | Gold/Min: {p1_core.get('averageGoldPerMinute', 0):.0f}
- Vision/Game: {p1_stats.get('vision', {}).get('averageVisionScore', 0):.1f}
- Dragons: {p1_stats.get('objectives', {}).get('totalDragonTakedowns', 0)} | Barons: {p1_stats.get('objectives', {}).get('totalBaronTakedowns', 0)}
- Pentakills: {p1_stats.get('achievements', {}).get('pentakills', 0)} | Perfect Games: {p1_stats.get('achievements', {}).get('perfectGames', 0)}

PLAYER 2 ({player2_name}) STATS:
- Win Rate: {p2_core.get('winRate', 0)*100:.1f}% | Games: {p2_core.get('totalGames', 0)}
- KDA: {p2_core.get('averageKDA', 0):.2f} | Kill Participation: {p2_core.get('killParticipation', 0)*100:.1f}%
- Damage/Game: {p2_core.get('averageDamagePerGame', 0):,.0f} | Gold/Min: {p2_core.get('averageGoldPerMinute', 0):.0f}
- Vision/Game: {p2_stats.get('vision', {}).get('averageVisionScore', 0):.1f}
- Dragons: {p2_stats.get('objectives', {}).get('totalDragonTakedowns', 0)} | Barons: {p2_stats.get('objectives', {}).get('totalBaronTakedowns', 0)}
- Pentakills: {p2_stats.get('achievements', {}).get('pentakills', 0)} | Perfect Games: {p2_stats.get('achievements', {}).get('perfectGames', 0)}

Generate a JSON response with this EXACT structure:

{{
  "title": "Catchy, controversial title using actual names",
  "winner": "player1 or player2 ",
  "summary": "2-3 punchy sentences using actual names, talking directly to players",
  "playstyles": "3-5 sentences comparing playstyles. Are they aggressive or passive? Mechanical gods or macro masters? Polar opposites or mirror images? Use League context and stats to tell their story.",
  "categories": [
    {{
      "category": "Category Name",
      "winner": "player1 or player2",
      "insight": "SHORT punchy insight with SPECIFIC NUMBERS, using actual names",
      "justification": "Detailed breakdown with all relevant stats compared",
      "emoji": "relevant emoji"
    }}
  ],
  "funFacts": [
    "Shareable facts with big numbers and actual player names",
    "Calculate impressive totals (damage to kill X Barons, wards placed, etc)",
    "Make comparisons to game objects",
    "Create 4-5 wild facts"
  ],
  "roast": "Friendly roast using actual name of losing player",
  "verdict": "Final verdict declaring winner by actual name with reasoning",
  "synergy": "3-4 sentences about duo queue potential. Be SPECIFIC about how their stats complement each other. Example: 'Player1's 25 vision/game + Player2's 40k damage = perfect combo. One lights up the map, the other capitalizes on every pick. Your playstyles would mesh perfectly in bot lane or jungle-mid synergy.'"
}}

CRITICAL REQUIREMENTS:
1. ANALYZE ALL STATS before deciding winners
2. ALWAYS include SPECIFIC NUMBERS in insights and synergy
3. USE ACTUAL NAMES ({player1_name} and {player2_name}) - NEVER "Player 1" or "Player 2"
4. BE DECISIVE - pick a winner unless stats are within 3%
5. Create 6-8 diverse categories: Mechanical Skill, Map Awareness, Clutch Factor, Champion Mastery, Consistency, Team Player, Objective Control, The Grind
6. Talk DIRECTLY to players using "you/your" in insights, summary, verdict, synergy
7. Calculate percentages and differences
8. Make synergy DETAILED with specific stat combinations and role suggestions

Return ONLY valid JSON."""

    try:
        response = bedrock_client.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 2000, "temperature": 0.8}
        )
        
        response_text = response['output']['message']['content'][0]['text']
        
        # Parse JSON response
        # Remove markdown code blocks if present
        if '```json' in response_text:
            response_text = response_text.split('```json')[1].split('```')[0].strip()
        elif '```' in response_text:
            response_text = response_text.split('```')[1].split('```')[0].strip()
        
        insights = json.loads(response_text)
        return insights
        
    except Exception as e:
        print(f"Error generating insights: {str(e)}")
        # Return fallback insights
        return {
            "title": f"{player1_name} vs {player2_name}",
            "winner": "tie",
            "summary": "Two skilled players battling it out on the Rift!",
            "categories": [],
            "funFacts": [],
            "roast": "Both players need to step up their game!",
            "verdict": "It's too close to call!",
            "synergy": "You two should duo queue and see what happens!"
        }


def lambda_handler(event, context):
    """
    Lambda handler for generating comparison reports
    Triggered via Function URL
    """
    try:
        # Parse request body (handle both direct invocation and Function URL)
        if 'body' in event:
            # Function URL invocation
            body = json.loads(event.get('body', '{}'))
        else:
            # Direct invocation (testing)
            body = event
        
        puuid1 = body.get('puuid1')
        puuid2 = body.get('puuid2')
        region = body.get('region', 'americas')
        
        if not puuid1 or not puuid2:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Both puuid1 and puuid2 are required'})
            }
        
        print(f"Generating comparison for {puuid1} vs {puuid2}")
        
        # Create processing marker with timestamp
        import time
        comparison_key = f"riot/comparisons/{puuid1}-vs-{puuid2}-processing.json"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=comparison_key,
            Body=json.dumps({
                'status': 'processing',
                'startedAt': int(time.time() * 1000),  # Milliseconds timestamp
                'requestId': context.aws_request_id
            }).encode('utf-8')
        )
        
        # Fetch both recaps
        print(f"[DEBUG] Fetching recaps from S3...")
        print(f"[DEBUG] PUUID1: {puuid1}")
        print(f"[DEBUG] PUUID2: {puuid2}")
        
        player1_recap = fetch_recap_from_s3(puuid1)
        player2_recap = fetch_recap_from_s3(puuid2)
        
        # Summoner info (profile icons) should already be in recap data
        # If not present, use default icon
        if 'summonerInfo' not in player1_recap:
            print(f"[DEBUG] No summonerInfo in player1 recap, using default")
            player1_recap['summonerInfo'] = {'profileIconId': 29}
        
        if 'summonerInfo' not in player2_recap:
            print(f"[DEBUG] No summonerInfo in player2 recap, using default")
            player2_recap['summonerInfo'] = {'profileIconId': 29}
        
        # Debug: Check if we got different data
        p1_kda = player1_recap.get('stats', {}).get('corePerformance', {}).get('averageKDA', 0)
        p2_kda = player2_recap.get('stats', {}).get('corePerformance', {}).get('averageKDA', 0)
        p1_icon = player1_recap.get('summonerInfo', {}).get('profileIconId', 29)
        p2_icon = player2_recap.get('summonerInfo', {}).get('profileIconId', 29)
        print(f"[DEBUG] Player1 KDA: {p1_kda}, Icon: {p1_icon}")
        print(f"[DEBUG] Player2 KDA: {p2_kda}, Icon: {p2_icon}")
        print(f"[DEBUG] Are recaps identical? {player1_recap == player2_recap}")
        
        # Get player names (REQUIRED - no fallback)
        player1_name_raw = body.get('player1Name')
        player2_name_raw = body.get('player2Name')
        
        if not player1_name_raw or not player2_name_raw:
            error_msg = f"Player names are required. Got: player1Name='{player1_name_raw}', player2Name='{player2_name_raw}'"
            print(f"[ERROR] {error_msg}")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': error_msg})
            }
        
        # Parse out tag lines (e.g., "hideonbush#kr1" -> "hideonbush")
        player1_name = player1_name_raw.split('#')[0] if '#' in player1_name_raw else player1_name_raw
        player2_name = player2_name_raw.split('#')[0] if '#' in player2_name_raw else player2_name_raw
        
        print(f"[Comparison] Player names (parsed): '{player1_name}' vs '{player2_name}'")
        
        # Generate comparison insights
        print("Generating AI insights...")
        insights = generate_comparison_insights(
            player1_recap, player2_recap,
            player1_name, player2_name
        )
        
        # Build final comparison data
        # Include summonerInfo at top level for easy access
        comparison_data = {
            'player1': {
                'puuid': puuid1,
                'name': player1_name,
                'summonerInfo': player1_recap.get('summonerInfo', {'profileIconId': 29}),
                'recap': player1_recap
            },
            'player2': {
                'puuid': puuid2,
                'name': player2_name,
                'summonerInfo': player2_recap.get('summonerInfo', {'profileIconId': 29}),
                'recap': player2_recap
            },
            'insights': insights,
            'generatedAt': context.aws_request_id
        }
        
        # Store in S3
        final_key = f"riot/comparisons/{puuid1}-vs-{puuid2}-latest.json"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=final_key,
            Body=json.dumps(comparison_data).encode('utf-8'),
            ContentType='application/json'
        )
        
        # Delete processing marker
        s3_client.delete_object(Bucket=S3_BUCKET, Key=comparison_key)
        
        print("Comparison generated successfully!")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'complete',
                'message': 'Comparison generated successfully'
            })
        }
        
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        import traceback
        print(traceback.format_exc())
        
        # Try to clean up processing marker
        try:
            comparison_key = f"riot/comparisons/{puuid1}-vs-{puuid2}-processing.json"
            s3_client.delete_object(Bucket=S3_BUCKET, Key=comparison_key)
        except:
            pass
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Failed to generate comparison',
                'details': str(e)
            })
        }
