import json
import os

import boto3
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get credentials from .env file
aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
aws_region = os.getenv("AWS_REGION", "us-east-2")

# Set credentials if they exist
if aws_access_key_id:
    os.environ["AWS_ACCESS_KEY_ID"] = aws_access_key_id
if aws_secret_access_key:
    os.environ["AWS_SECRET_ACCESS_KEY"] = aws_secret_access_key
if aws_region:
    os.environ["AWS_DEFAULT_REGION"] = aws_region

# Initialize Bedrock client
bedrock = boto3.client("bedrock-runtime", region_name=aws_region)

# Simple test prompt
body = {
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 500,
    "messages": [
        {
            "role": "user",
            "content": 'Say hello and confirm you\'re working. Respond in JSON: {"status": "working", "message": "your message"}',
        }
    ],
}

try:
    print("Testing Bedrock access...")
    # Use full ARN for the model
    model_id = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
    response = bedrock.invoke_model(modelId=model_id, body=json.dumps(body))

    result = json.loads(response["body"].read())
    print("\n✅ SUCCESS! Bedrock is accessible")
    print("\nResponse:")
    print(result["content"][0]["text"])

except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    print("\nTroubleshooting:")
    if not aws_access_key_id or not aws_secret_access_key:
        print("1. ⚠️  Missing AWS credentials in .env file")
        print("   Add to .env: AWS_ACCESS_KEY_ID=your_key")
        print("   Add to .env: AWS_SECRET_ACCESS_KEY=your_secret")
    print("2. Verify IAM user/role has Bedrock permissions")
    print("3. Check if model access is granted in Bedrock console")
    print(f"4. Verify region ({aws_region}) supports Bedrock")
