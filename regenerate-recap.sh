#!/bin/bash

# Regenerate a player's recap
# Usage: ./regenerate-recap.sh <puuid> <region>
# Example: ./regenerate-recap.sh "6OWDd0eYfb-cLv5b5JZAy-DP6fqHq4ARl6GrPrulN61kapkzgdTgYvqwXAahpfcMSHHmc3iTHhHlIQ" "asia"

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./regenerate-recap.sh <puuid> <region>"
  echo "Example: ./regenerate-recap.sh \"6OWDd0eYfb...\" \"asia\""
  exit 1
fi

PUUID="$1"
REGION="$2"

echo "🔄 Regenerating recap for PUUID: $PUUID"
echo "   Region: $REGION"
echo ""

# URL encode the PUUID for S3 key
ENCODED_PUUID=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$PUUID', safe='-_.!~*\'()'))")

# Delete existing recap from S3
echo "🗑️  Deleting old recap from S3..."
aws s3 rm "s3://playmaker-rift-rewind/riot/season-recaps/${ENCODED_PUUID}-latest.json" --region us-east-2 2>/dev/null || echo "   (No existing recap found)"

# Delete processing marker if exists
aws s3 rm "s3://playmaker-rift-rewind/riot/season-recaps/${ENCODED_PUUID}-processing.json" --region us-east-2 2>/dev/null || true

echo ""
echo "🚀 Triggering new recap generation..."

# Call the recap generation API
curl -X POST "http://localhost:3000/api/riot/recap/generate" \
  -H "Content-Type: application/json" \
  -d "{\"puuid\":\"$PUUID\",\"region\":\"$REGION\"}"

echo ""
echo ""
echo "✅ Recap regeneration triggered!"
echo "   Check the logs to see when it completes."
