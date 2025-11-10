#!/bin/bash

# Deploy Lambda functions
# Usage: ./deploy-lambdas.sh

set -e

echo "📦 Creating Lambda deployment packages..."

# Deploy Recap Lambda
echo ""
echo "🔄 Deploying Recap Lambda..."
cd lambda/riot/recap
zip -r recap-lambda.zip . -x "*.pyc" -x "__pycache__/*" -x ".DS_Store" > /dev/null
aws lambda update-function-code \
  --function-name playmaker-recap-generator \
  --zip-file fileb://recap-lambda.zip \
  --region us-east-2
rm recap-lambda.zip
cd ../../..
echo "✅ Recap Lambda deployed"

# Deploy Comparison Lambda
echo ""
echo "🔄 Deploying Comparison Lambda..."
cd lambda/riot/comparison
zip -r comparison-lambda.zip . -x "*.pyc" -x "__pycache__/*" -x ".DS_Store" > /dev/null
aws lambda update-function-code \
  --function-name playmaker-comparison-generator \
  --zip-file fileb://comparison-lambda.zip \
  --region us-east-2
rm comparison-lambda.zip
cd ../../..
echo "✅ Comparison Lambda deployed"

echo ""
echo "🎉 All Lambdas deployed successfully!"
