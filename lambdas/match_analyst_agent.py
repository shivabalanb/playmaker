"""
League of Legends Match Analyst Agent using Strands SDK
WebSocket implementation for real-time match analysis
"""

import os
import boto3
import json
import re
from typing import Dict, Any, Optional, List
from strands import Agent, tool
from strands.models import BedrockModel

# -----------------------------
# Configuration
# -----------------------------
KNOWLEDGE_BASE_ID = os.environ.get("KNOWLEDGE_BASE_ID", "your-kb-id-here")
REGION = os.environ.get("AWS_REGION", "us-east-2")
AGENT_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"

account_id = boto3.client('sts').get_caller_identity()['Account']
KB_MODEL_ARN = (
    f"arn:aws:bedrock:{REGION}:{account_id}:inference-profile/"
    "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
)

bedrock_client = boto3.client('bedrock-agent-runtime', region_name=REGION)
bedrock_runtime = boto3.client('bedrock-runtime', region_name=REGION)
model = BedrockModel(model_id=AGENT_MODEL_ID, region_name=REGION)


# -----------------------------
# System Prompt
# -----------------------------
SYSTEM_PROMPT = """
You are a League of Legends match analyst expert. You have access to detailed parsed match
timeline data through a knowledge base. The timeline data includes:

- Frame-by-frame participant status (gold, level, HP, CS, XP)
- Lane differentials (TOP, MIDDLE, BOTTOM, JUNGLE) for gold and level
- Team differentials (gold, level, turrets, objectives)
- Game phase markers (EARLY_GAME 0-15min, MID_GAME 15-25min, LATE_GAME 25+min)
- Event logs (kills, objectives, item purchases, etc.)
- Claimed feats and objectives (dragons, baron, turrets, etc.)
- Change in last minute metrics

IMPORTANT: 
- You are analyzing a SPECIFIC match. All data returned is automatically filtered to that match.
- Always provide specific, data-driven insights with timestamps.
- Reference concrete events, gold differentials, and objective timings.
- Use multiple tools if needed to get a complete picture.
- Only answer the question of the user. 
- Level differentials are ONLY important when greater than 5. Refer to level differential by 
  average across all 5 players.
- Purchasing items faster within the first 1:00 of the game is irrelevant.

When analyzing:
- Early game = 0-15 minutes
- Mid game = 15-25 minutes  
- Late game = 25+ minutes
"""


# -----------------------------
# Helper Functions
# -----------------------------
def extract_match_id_from_uri(uri: str) -> Optional[str]:
    """
    Extract match ID from S3 URI.
    Example: s3://bucket/parsed-timelines/NA1_5342051812-parsed.txt -> NA1_5342051812
    """
    match = re.search(r'/([A-Z0-9]+_\d+)-parsed\.txt$', uri)
    return match.group(1) if match else None


def filter_results_by_match(results: list, target_match_id: str) -> list:
    """
    Filter retrieval results to only include those from the target match.
    """
    filtered = []
    for result in results:
        metadata = result.get('metadata', {})
        source_uri = metadata.get('x-amz-bedrock-kb-source-uri', '')
        match_id = extract_match_id_from_uri(source_uri)
        
        if match_id == target_match_id:
            filtered.append(result)
    
    return filtered


def send_response(connection_id, domain_name, stage, data):
    """
    Send a message back to the client through the WebSocket connection.
    
    This function uses the API Gateway Management API to post messages back
    to connected WebSocket clients.
    """
    
    # Construct the API Gateway Management API endpoint
    # Format: https://{domain}/{stage}
    endpoint = f'https://{domain_name}/{stage}'
    
    # Initialize the API Gateway Management API client
    client = boto3.client('apigatewaymanagementapi', endpoint_url=endpoint)
    
    try:
        print(f"Sending message to connection {connection_id}")
        print(f"   Message type: {data.get('type')}, Content length: {len(data.get('content', ''))}")
        
        # Send the message to the connected client
        client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(data).encode('utf-8')
        )
        
        print(f"Message sent successfully")
        
    except client.exceptions.GoneException:
        # Connection no longer exists (client disconnected)
        print(f"Connection {connection_id} is no longer available")
        raise
        
    except Exception as e:
        print(f"Error sending message: {str(e)}")
        raise


# -----------------------------
# Tool Factory - Creates tools bound to a specific match
# -----------------------------
def create_match_tools(match_id: str):
    """
    Factory function that creates tool instances bound to a specific match_id.
    This eliminates the need for global variables.
    """
    
    @tool
    def query_match_timeline(query: str, max_results: int = 10) -> str:
        """
        Query the parsed match timeline data for specific information about a match.
        Retrieves more results than needed, then filters to current match.
        """
        try:
            # Retrieve MORE results since we'll filter afterwards
            retrieval_config = {
                'vectorSearchConfiguration': {
                    'numberOfResults': min(max_results * 3, 30)
                }
            }

            # Enhance query with match context for better semantic matching
            enhanced_query = f"Match {match_id}: {query}"

            # Use retrieve (not retrieve_and_generate) so we can filter before generation
            response = bedrock_client.retrieve(
                knowledgeBaseId=KNOWLEDGE_BASE_ID,
                retrievalQuery={'text': enhanced_query},
                retrievalConfiguration=retrieval_config
            )

            # Get all results
            all_results = response.get('retrievalResults', [])
            
            # Filter to only results from current match
            filtered_results = filter_results_by_match(all_results, match_id)
            print(f"Filtered {len(all_results)} results down to {len(filtered_results)} for match {match_id}")
            
            if not filtered_results:
                return f"No data found for match {match_id}. The match may not be in the knowledge base."
            
            # Take top N after filtering
            filtered_results = filtered_results[:max_results]
            
            # Build context from filtered results for generation
            context_parts = []
            for i, result in enumerate(filtered_results):
                content = result.get('content', {}).get('text', '')
                context_parts.append(f"[Source {i+1}]\n{content}")
            
            combined_context = "\n\n".join(context_parts)
            
            # Create a custom prompt that includes our filtered context
            generation_prompt = f"""Based on the following match timeline data for match {match_id}, answer this question: {query}

Timeline Data:
{combined_context}

Provide a specific, data-driven analysis with timestamps and concrete details from the timeline."""
            
            # Use bedrock directly for generation with our filtered context
            generation_response = bedrock_runtime.invoke_model(
                modelId=AGENT_MODEL_ID,
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 2000,
                    "messages": [
                        {
                            "role": "user",
                            "content": generation_prompt
                        }
                    ]
                })
            )
            
            response_body = json.loads(generation_response['body'].read())
            answer = response_body['content'][0]['text']
            
            result = f"Analysis: {answer}\n\nSources: {len(filtered_results)} timeline chunks from match {match_id}"
            return result
            
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return f"Error querying match timeline: {str(e)}"

    @tool
    def analyze_game_phase(phase: str, query: str = "") -> str:
        """Analyze a specific game phase (EARLY_GAME, MID_GAME, LATE_GAME)"""
        phase_query = f"Analyze {phase} phase data. {query}".strip()
        return query_match_timeline(phase_query, max_results=8)

    @tool
    def analyze_lane_performance(lane: str, query: str = "") -> str:
        """Analyze performance in a specific lane (TOP, MIDDLE, BOTTOM, JUNGLE)"""
        lane_query = f"Analyze {lane} lane performance, gold differentials, level differentials. {query}".strip()
        return query_match_timeline(lane_query, max_results=8)

    @tool
    def analyze_objectives_and_feats(query: str = "") -> str:
        """Analyze objectives like dragons, baron, turrets, and other feats"""
        objective_query = f"Analyze objectives, dragons, baron, turrets, and claimed feats. {query}".strip()
        return query_match_timeline(objective_query, max_results=10)

    @tool
    def analyze_team_differentials(query: str = "") -> str:
        """Analyze team-level differentials in gold, level, turrets, objectives"""
        diff_query = f"Analyze team differentials including gold, level, turret, and objective differentials. {query}".strip()
        return query_match_timeline(diff_query, max_results=8)

    @tool
    def get_match_summary(query: str = "") -> str:
        """Get overall match summary and key moments"""
        summary_query = f"Provide match summary, key events, turning points. {query}".strip()
        return query_match_timeline(summary_query, max_results=12)
    
    return [
        query_match_timeline,
        analyze_game_phase,
        analyze_lane_performance,
        analyze_objectives_and_feats,
        analyze_team_differentials,
        get_match_summary
    ]


# -----------------------------
# Message Handler
# -----------------------------
def handle_message(event: Dict[str, Any], messages: List[Dict[str, str]], match_id: str) -> str:
    """
    Process user messages using the Strands AI agent for match analysis.
    
    This function initializes a Strands agent with match-specific tools
    and the configured system prompt, then processes the user's message 
    to generate a response.
    """
    try:
        # Create tools bound to the specific match ID
        tools = create_match_tools(match_id)
        
        # Initialize the Strands agent with system prompt and match-specific tools
        # The agent is created fresh for each invocation to ensure clean state
        agent = Agent(
            model=model,
            system_prompt=SYSTEM_PROMPT,
            tools=tools
        )
        
        # Extract the most recent user message from the conversation
        # Messages array contains full conversation history for context
        user_message = messages[-1]['content'] if messages else ''
        
        print(f"Processing match {match_id} message: {user_message[:100]}...")
        
        # Invoke the agent to generate a response
        # The agent will use its match-specific tools and reasoning to formulate an answer
        response = agent(user_message)
        
        print(f"Agent response generated: {len(str(response))} characters")
        
        return str(response)
        
    except Exception as e:
        print(f"Error in handle_message: {str(e)}")
        raise


# -----------------------------
# Main Lambda Handler
# -----------------------------
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for WebSocket API Gateway events.
    Handles real-time League of Legends match analysis over WebSocket connections.
    """
    try:
        # Extract WebSocket connection information from the event
        request_context = event['requestContext']
        connection_id = request_context['connectionId']
        domain_name = request_context['domainName']
        stage = request_context['stage']
        route_key = request_context.get('routeKey')
        
        print(f"Received event: route={route_key}, connection={connection_id}")
        
        # Handle $default route - process incoming chat messages
        if route_key == '$default':
            # Parse the message body from the WebSocket message
            body = json.loads(event.get('body', '{}'))
            messages = body.get('messages', [])
            match_id = body.get('matchId')
            
            # Validate required fields
            if not match_id:
                error_msg = "matchId is required in the request body"
                print(f"Validation error: {error_msg}")
                send_response(connection_id, domain_name, stage, {
                    'type': 'error',
                    'content': error_msg
                })
                return {
                    'statusCode': 400,
                    'body': json.dumps({'message': error_msg})
                }
            
            if not messages:
                error_msg = "messages array is required and cannot be empty"
                print(f"Validation error: {error_msg}")
                send_response(connection_id, domain_name, stage, {
                    'type': 'error',
                    'content': error_msg
                })
                return {
                    'statusCode': 400,
                    'body': json.dumps({'message': error_msg})
                }
            
            print(f"Processing {len(messages)} message(s) for match {match_id}")
            
            try:
                # Generate response using the Strands agent with match-specific context
                response_text = handle_message(event, messages, match_id)
                
                # Send the response content back to the client
                # Using 'chunk' type to support potential streaming in the future
                send_response(connection_id, domain_name, stage, {
                    'type': 'chunk',
                    'content': response_text
                })
                
                # Send end signal to indicate response is complete
                # Client can use this to stop showing loading indicators
                send_response(connection_id, domain_name, stage, {
                    'type': 'end',
                    'content': ''
                })
                
                # Return success response
                # Note: The client receives messages via WebSocket, not this HTTP response
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'type': 'chunk',
                        'content': response_text,
                        'matchId': match_id
                    })
                }
                
            except Exception as e:
                # Handle errors during message processing
                error_message = f"Error processing message: {str(e)}"
                print(f"{error_message}")
                import traceback
                print(traceback.format_exc())
                
                # Attempt to send error message back to client
                try:
                    send_response(connection_id, domain_name, stage, {
                        'type': 'error',
                        'content': 'Sorry, I encountered an error analyzing the match. Please try again.'
                    })
                except:
                    # If we can't send error to client, just log it
                    print("Could not send error message to client")
                
                return {
                    'statusCode': 500,
                    'body': json.dumps({'message': str(e)})
                }
        
        # Handle other routes (like $connect, $disconnect) - currently no-op
        else:
            print(f"Unhandled route: {route_key}")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Route not implemented'})
            }
    
    # Handle unexpected errors at the handler level
    except KeyError as e:
        # Missing required fields in the event
        error_message = f"Missing required field in event: {str(e)}"
        print(f"{error_message}")
        return {
            'statusCode': 400,
            'body': json.dumps({'message': error_message})
        }
        
    except Exception as e:
        # Catch-all for any other unexpected errors
        error_message = f"Unexpected error in lambda_handler: {str(e)}"
        print(f"{error_message}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Internal server error'})
        }


# -----------------------------
# Local testing
# -----------------------------
if __name__ == "__main__":
    # Simulate WebSocket event
    test_event = {
        "requestContext": {
            "connectionId": "test-connection-123",
            "domainName": "test.execute-api.us-east-1.amazonaws.com",
            "stage": "dev",
            "routeKey": "$default"
        },
        "body": json.dumps({
            "matchId": "KR_7858019563",
            "messages": [
                {
                    "role": "user",
                    "content": "What happened in the early game?"
                }
            ]
        })
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(json.loads(result["body"]), indent=2))