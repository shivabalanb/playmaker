# Complete Setup Guide

This is the only file you need to set up the League of Legends match analysis system.

## What This System Does

1. **`parsetimeline.py`** - Parses match timelines from Riot API and saves to S3
2. **`match_analyst_agent.py`** - RAG agent that answers questions about matches using Bedrock Knowledge Base

## Prerequisites

- AWS Account with Bedrock access
- S3 bucket for storing parsed timelines
- Riot API key stored in AWS Systems Manager Parameter Store
- Docker installed (for building Lambda packages)

## Step 1: Create IAM Role for Lambda

1. Go to AWS Console → IAM → Roles → Create role
2. Select "AWS service" → "Lambda"
3. Attach policy: `AWSLambdaBasicExecutionRole`
4. Name: `MatchAnalystAgentRole`
5. Create role

6. Click on the role → Add permissions → Create inline policy → JSON tab
7. Paste this:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "BedrockKnowledgeBaseAccess",
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
                "bedrock:Retrieve",
                "bedrock:RetrieveAndGenerate"
            ],
            "Resource": "*"
        },
        {
            "Sid": "KnowledgeBaseAccess",
            "Effect": "Allow",
            "Action": [
                "bedrock:GetKnowledgeBase",
                "bedrock:ListKnowledgeBases"
            ],
            "Resource": "*"
        }
    ]
}
```
8. Name: `BedrockAccessPolicy` → Create policy

## Step 2: Create Knowledge Base

1. Go to AWS Console → Bedrock → Knowledge bases → Create knowledge base
2. Name: `match-timeline-kb`
3. Data source:
   - Name: `parsed-timelines-s3`
   - S3 bucket: Your bucket
   - S3 prefix: `parsed-timelines/`
   - File format: Plain text
4. Embedding model: `amazon.titan-embed-text-v1`
5. Vector store: Quick create a new vector store
6. Create knowledge base

**Note**: Knowledge Base automatically extracts S3 object metadata (including `match-id`) when indexing.

## Step 3: Deploy Parsing Lambda (`parsetimeline.py`)

1. Go to AWS Console → Lambda → Create function
2. Name: `parse-match-timeline`
3. Runtime: Python 3.12
4. Architecture: x86_64
5. Execution role: `MatchAnalystAgentRole`
6. Create function

7. Upload code:
   - Create deployment package:
   ```bash
   cd lambdas
   mkdir -p lambda-package
   cd lambda-package
   pip install boto3 urllib3 -t .
   cp ../parsetimeline.py .
   zip -r ../parse-timeline.zip .
   cd ..
   ```
   - In Lambda console: Upload from → .zip file → Select `parse-timeline.zip`

8. Environment variables:
   - `S3_BUCKET_NAME`: Your bucket name
   - `RIOT_API_KEY_SSM_PARAM`: `/playmaker/riot-api-key` (or your SSM param)

9. Handler: `parsetimeline.lambda_handler`

10. Test with:
```json
{
  "matchId": "KR_7858019563",
  "region": "asia"
}
```

11. Verify: Check S3 bucket → `parsed-timelines/KR_7858019563-parsed.txt` exists

## Step 4: Sync Knowledge Base

1. Go to Bedrock → Knowledge bases → Your KB → Data sources
2. Click "Sync" button
3. Wait for sync to complete

## Step 5: Deploy Agent Lambda (`match_analyst_agent.py`)

1. Go to AWS Console → Lambda → Create function
2. Name: `match-analyst-agent`
3. Runtime: Python 3.12
4. Architecture: x86_64
5. Execution role: `MatchAnalystAgentRole`
6. Create function

7. Build deployment package (MUST use Docker for compiled extensions):
   ```bash
   cd lambdas
   rm -rf lambda-package match-analyst-agent.zip
   mkdir -p lambda-package
   
   # Use Docker to install packages for Linux
   docker run --rm \
     -v $(pwd):/var/task \
     public.ecr.aws/lambda/python:3.12 \
     /bin/bash -c "pip install --upgrade pip && pip install strands boto3 -t /var/task/lambda-package"
   
   # Copy your function code
   cp match_analyst_agent.py lambda-package/
   
   # Create zip file
   cd lambda-package
   zip -r ../match-analyst-agent.zip . -x "*.pyc" "__pycache__/*"
   cd ..
   ```

8. Upload: Lambda console → Upload from → .zip file → Select `match-analyst-agent.zip`

9. Environment variables:
   - `KNOWLEDGE_BASE_ID`: Your KB ID (from Step 2)
   - `AWS_REGION`: `us-east-1` (or your region)
   - `MODEL_ID`: `anthropic.claude-sonnet-4-20250514-v1:0`

10. Handler: `match_analyst_agent.lambda_handler`
11. Timeout: 60 seconds
12. Memory: 512 MB

## Step 6: Create API Gateway

1. Go to AWS Console → API Gateway → Create API
2. Choose REST API → Build
3. Name: `match-analyst-api`
4. Create API

5. Create resource:
   - Actions → Create Resource
   - Resource name: `analyze`
   - Create Resource

6. Create method:
   - Select `/analyze` → Actions → Create Method → POST
   - Integration type: Lambda Function
   - Lambda Function: `match-analyst-agent`
   - Save → OK

7. Enable CORS:
   - Select POST method → Actions → Enable CORS
   - Default settings → Enable CORS and replace existing CORS headers

8. Deploy API:
   - Actions → Deploy API
   - Deployment stage: `[New Stage]`
   - Stage name: `prod`
   - Deploy

9. Get endpoint URL:
   - Copy the Invoke URL (looks like: `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod`)

## Step 7: Test

```bash
curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What happened in the early game?",
    "matchId": "KR_7858019563"
  }'
```

## Troubleshooting

### "No module named 'strands'"
- Make sure you installed `strands` in Docker build
- Rebuild package with Docker and re-upload

### "No module named 'pydantic_core._pydantic_core'"
- You MUST use Docker to build the package
- Rebuild with: `docker run --rm -v $(pwd):/var/task public.ecr.aws/lambda/python:3.12 /bin/bash -c "pip install strands boto3 -t /var/task/lambda-package"`

### "matchId is required"
- Always include `matchId` in your request:
```json
{
  "question": "...",
  "matchId": "KR_7858019563"
}
```

### "Knowledge Base not found"
- Check `KNOWLEDGE_BASE_ID` environment variable in Lambda
- Make sure Knowledge Base is in the same region as Lambda

### No results found
- Make sure you've parsed at least one match (Step 3)
- Make sure Knowledge Base is synced (Step 4)
- Check S3 bucket has files with `match-id` metadata

## Quick Reference

**Files:**
- `parsetimeline.py` - Parses match timelines
- `match_analyst_agent.py` - RAG agent for analysis

**Environment Variables:**
- `S3_BUCKET_NAME` - S3 bucket for parsed timelines
- `KNOWLEDGE_BASE_ID` - Your Bedrock Knowledge Base ID
- `AWS_REGION` - AWS region
- `MODEL_ID` - Bedrock model ID

**API Request Format:**
```json
{
  "question": "Your question here",
  "matchId": "KR_7858019563"
}
```

**Important Notes:**
- Always use Docker to build Lambda packages (for compiled extensions)
- Python version in Docker must match Lambda runtime (use 3.12)
- All queries require `matchId` parameter
- Knowledge Base automatically extracts S3 metadata (no manual config needed)

