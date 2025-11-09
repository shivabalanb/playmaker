import json
import os
import time
from typing import Any, Dict, List

import boto3
import urllib3
from botocore.exceptions import ClientError

# Disable SSL warnings (optional, for cleaner logs)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Initialize AWS clients
ssm_client = boto3.client("ssm")
s3_client = boto3.client("s3")
http = urllib3.PoolManager()


def get_riot_api_key() -> str:
    """
    Get Riot API key from SSM Parameter Store.
    """
    parameter_name = os.environ.get("RIOT_API_KEY_SSM_PARAM", "/playmaker/riot-api-key")

    try:
        response = ssm_client.get_parameter(
            Name=parameter_name, WithDecryption=True  # If stored as SecureString
        )
        return response["Parameter"]["Value"]
    except ClientError as e:
        print(f"Error fetching API key from SSM: {e}")
        raise Exception("Failed to retrieve Riot API key from SSM")


def fetch_with_retry(
    url: str, headers: Dict[str, str], retries: int = 3
) -> Dict[str, Any]:
    """
    Fetch from Riot API with retry logic for rate limiting (using urllib3).
    """
    for i in range(retries):
        try:
            response = http.request("GET", url, headers=headers, timeout=30)

            # If rate limited (429), check for Retry-After header
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
                # Generic error for all other status codes
                error_text = response.data.decode("utf-8")
                raise Exception(f"Riot API error ({response.status}): {error_text}")

        except urllib3.exceptions.HTTPError:
            if i == retries - 1:
                raise
            time.sleep(2**i)
        except Exception as e:
            if i == retries - 1:
                raise Exception(f"Request failed. Retry {i + 1}/{retries}: {e}")
            time.sleep(2**i)


def save_to_s3(
    match_id: str, timeline_data: Dict[str, Any], region: str
) -> Dict[str, str]:
    """
    Save timeline JSON data to S3 bucket.
    """
    bucket_name = os.environ.get("S3_BUCKET_NAME")

    if not bucket_name:
        raise ValueError("S3_BUCKET_NAME environment variable not set")

    # Sanitize match_id for S3 key (remove special characters)
    safe_match_id = match_id.replace("/", "_").replace(":", "_")
    key = f"riot/match-timelines/{safe_match_id}-timeline.json"

    try:
        # Convert timeline data to JSON string
        json_body = json.dumps(timeline_data, indent=2)

        # Upload to S3
        s3_client.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=json_body.encode("utf-8"),
            ContentType="application/json",
            Metadata={
                "matchId": match_id,
                "region": region,
            },
        )

        print(f"Successfully saved timeline to s3://{bucket_name}/{key}")

        return {"bucket": bucket_name, "key": key, "s3Uri": f"s3://{bucket_name}/{key}"}
    except ClientError as e:
        raise Exception(f"Failed to save timeline to S3: {str(e)}")


def parse_event(event: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Parse API Gateway event to extract match IDs with their regions.
    Returns list of {matchId, region} dictionaries.
    Expected format: {"matches": [{"matchId": "...", "region": "..."}, ...]}
    """
    if "body" in event:
        body = (
            json.loads(event["body"])
            if isinstance(event["body"], str)
            else event["body"]
        )
    else:
        body = event

    if "matches" in body and isinstance(body["matches"], list):
        return body["matches"]

    return []


def s3_object_exists(bucket_name: str, key: str) -> bool:
    """Check if an object exists in S3."""
    try:
        s3_client.head_object(Bucket=bucket_name, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def get_from_s3(bucket_name: str, key: str) -> Dict[str, Any]:
    """Read timeline data from S3."""
    try:
        response = s3_client.get_object(Bucket=bucket_name, Key=key)
        json_body = response["Body"].read().decode("utf-8")
        return json.loads(json_body)
    except ClientError as e:
        raise Exception(f"Failed to read from S3: {str(e)}")


# Example test case:
# {
#   "matches": [
#     {"matchId": "KR_7858254806", "region": "asia"},
#     {"matchId": "NA1_123456", "region": "americas"}
#   ]
# }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler function.
    Fetches match timeline data from Riot API and saves to S3.
    Expected event format: {"matches": [{"matchId": "KR_123", "region": "asia"}, {"matchId": "NA1_456", "region": "americas"}]}
    """
    print(f"Event received: {json.dumps(event, default=str)}")

    try:
        matches = parse_event(event)

        if not matches:
            return {
                "statusCode": 400,
                "body": json.dumps(
                    {"error": "matches array is required", "received": event}
                ),
            }

        api_key = get_riot_api_key()
        headers = {"X-Riot-Token": api_key}
        results = []

        for i, match_info in enumerate(matches):
            match_id = match_info["matchId"]
            region = match_info["region"]

            try:
                print(
                    f"Processing match {i+1}/{len(matches)}: {match_id} (region: {region})"
                )

                safe_match_id = match_id.replace("/", "_").replace(":", "_")
                key = f"riot/match-timelines/{safe_match_id}-timeline.json"
                bucket_name = os.environ.get("S3_BUCKET_NAME")

                if s3_object_exists(bucket_name, key):
                    # File already exists - read from S3 instead of calling API
                    timeline_data = get_from_s3(bucket_name, key)
                    results.append(
                        {
                            "matchId": match_id,
                            "success": True,
                            "s3Location": {
                                "bucket": bucket_name,
                                "key": key,
                                "s3Uri": f"s3://{bucket_name}/{key}",
                            },
                            "timelineData": timeline_data,
                            "cached": True,
                        }
                    )
                    continue

                # Fetch timeline from Riot API using match-specific region
                timeline_url = (
                    f"https://{region}.api.riotgames.com/"
                    f"lol/match/v5/matches/{match_id}/timeline"
                )

                timeline_data = fetch_with_retry(timeline_url, headers)
                s3_result = save_to_s3(match_id, timeline_data, region)

                results.append(
                    {
                        "matchId": match_id,
                        "success": True,
                        "s3Location": s3_result,
                        "timelineData": timeline_data,
                        "region": region,
                        "cached": False,
                    }
                )

                # Small delay between requests to avoid rate limits
                if len(matches) > 1 and i < len(matches) - 1:
                    time.sleep(0.1)

            except Exception as e:
                results.append({"matchId": match_id, "success": False, "error": str(e)})

        return {
            "statusCode": 200,
            "body": json.dumps({"results": results}),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
