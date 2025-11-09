"""
League of Legends Match Analyst - Simplified with RetrieveAndGenerate
Uses Bedrock's integrated RAG for streamlined architecture
"""

import os
import boto3
import json
from typing import Dict, Any, List

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


# -----------------------------
# Helper Functions
# -----------------------------
def send_response(connection_id, domain_name, stage, data):
    """
    Send a message back to the client through the WebSocket connection.
    """
    endpoint = f'https://{domain_name}/{stage}'
    client = boto3.client('apigatewaymanagementapi', endpoint_url=endpoint)
    
    try:
        print(f"Sending message to connection {connection_id}")
        print(f"   Message type: {data.get('type')}, Content length: {len(data.get('content', ''))}")
        
        client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(data).encode('utf-8')
        )
        
        print(f"Message sent successfully")
        
    except client.exceptions.GoneException:
        print(f"Connection {connection_id} is no longer available")
        raise
        
    except Exception as e:
        print(f"Error sending message: {str(e)}")
        raise


# -----------------------------
# Core RAG Logic
# -----------------------------
def analyze_match(user_message: str, match_id: str, conversation_history: List[Dict[str, str]]) -> str:
    """
    Perform RAG analysis using Bedrock's retrieve_and_generate for streamlined processing.
    """
    try:
        # Build conversation history for context
        history_text = ""
        if len(conversation_history) > 1:  # More than just current message
            history_text = "\nConversation History:\n"
            for msg in conversation_history[:-1]:  # Exclude current message
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                history_text += f"{role.upper()}: {content}\n"
            history_text += "\n"
        
        # Enhance query with match context and history
        enhanced_query = f"{history_text}Match {match_id}: {user_message}"
        
        print(f"Processing query for match {match_id}: {user_message[:100]}...")
        
        # Configure retrieval with match-specific filtering
        retrieval_config = {
            'vectorSearchConfiguration': {
                'numberOfResults': 30,
                'filter': {
                    'equals': {
                        'key': 'x-amz-bedrock-kb-source-uri',
                        'value': f's3://playmaker-adwaith66/parsed-timelines/{match_id}-parsed.txt'
                    }
                }
            }
        }
        
        # System prompt for the generation
        system_prompt = """You are a League of Legends match analyst expert. You have access to detailed parsed match timeline data that includes:

- Frame-by-frame participant status (gold, level, HP, CS, XP)
- Lane differentials (TOP, MIDDLE, BOTTOM, JUNGLE) for gold and level
- Team differentials (gold, level, turrets, objectives)
- Game phase markers (EARLY_GAME 0-15min, MID_GAME 15-25min, LATE_GAME 25+min)
- Event logs (kills, objectives, item purchases, etc.)
- Claimed feats and objectives (dragons, baron, turrets, etc.)
- Change in last minute metrics

IMPORTANT ANALYSIS GUIDELINES:
- Always provide specific, data-driven insights with timestamps
- Reference concrete events, gold differentials, and objective timings
- Level differentials are ONLY important when greater than 5
- Refer to level differential by average across all 5 players
- Purchasing items faster within the first 1:00 of the game is irrelevant
- Only answer the user's specific question - don't over-explain

Game Phases:
- Early game = 0-15 minutes
- Mid game = 15-25 minutes  
- Late game = 25+ minutes

Provide comprehensive but concise analysis based on the data provided."""

        # Use retrieve_and_generate for integrated RAG
        response = bedrock_client.retrieve_and_generate(
            input={
                'text': enhanced_query
            },
            retrieveAndGenerateConfiguration={
                'type': 'KNOWLEDGE_BASE',
                'knowledgeBaseConfiguration': {
                    'knowledgeBaseId': KNOWLEDGE_BASE_ID,
                    'modelArn': KB_MODEL_ARN,
                    'retrievalConfiguration': retrieval_config,
                    'generationConfiguration': {
                        'promptTemplate': {
                            'textPromptTemplate': f"""{system_prompt}

Based on the following match timeline data, answer this question: $query$

Timeline Data:
$search_results$

Provide a specific, data-driven analysis with timestamps and concrete details from the timeline. Be comprehensive but concise."""
                        },
                        'inferenceConfig': {
                            'textInferenceConfig': {
                                'maxTokens': 4000,
                                'temperature': 0.7
                            }
                        }
                    }
                }
            }
        )
        
        # Extract the generated response
        answer = response['output']['text']
        
        # Log citation information if available
        citations = response.get('citations', [])
        if citations:
            print(f"Response used {len(citations)} citation(s)")
            for i, citation in enumerate(citations[:3]):  # Log first 3
                retrieved_refs = citation.get('retrievedReferences', [])
                print(f"  Citation {i+1}: {len(retrieved_refs)} references")
        
        print(f"Generated response: {len(answer)} characters")
        
        return answer
        
    except Exception as e:
        import traceback
        print(f"Error in analyze_match: {str(e)}")
        print(traceback.format_exc())
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
                # Get the current user message
                user_message = messages[-1]['content'] if messages else ''
                
                # Generate response using retrieve_and_generate
                response_text = analyze_match(user_message, match_id, messages)
                
                # Send the response content back to the client
                send_response(connection_id, domain_name, stage, {
                    'type': 'chunk',
                    'content': response_text
                })
                
                # Send end signal to indicate response is complete
                send_response(connection_id, domain_name, stage, {
                    'type': 'end',
                    'content': ''
                })
                
                # Return success response (just for API Gateway, not sent to client)
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Response sent successfully'
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
        error_message = f"Missing required field in event: {str(e)}"
        print(f"{error_message}")
        return {
            'statusCode': 400,
            'body': json.dumps({'message': error_message})
        }
        
    except Exception as e:
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