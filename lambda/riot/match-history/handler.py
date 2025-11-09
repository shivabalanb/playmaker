import json
import os
import re
import time
from typing import Any, Dict
from urllib.parse import quote

import boto3
import urllib3
from botocore.exceptions import ClientError

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Initialize AWS clients
ssm_client = boto3.client("ssm")
s3_client = boto3.client("s3")
http = urllib3.PoolManager()


def get_riot_api_key() -> str:
    """Get Riot API key from SSM Parameter Store."""
    parameter_name = os.environ.get("RIOT_API_KEY_SSM_PARAM", "/playmaker/riot-api-key")

    try:
        response = ssm_client.get_parameter(Name=parameter_name, WithDecryption=True)
        return response["Parameter"]["Value"]
    except ClientError as e:
        raise Exception("Failed to retrieve Riot API key from SSM")


def fetch_with_retry(
    url: str, headers: Dict[str, str], retries: int = 3
) -> Dict[str, Any]:
    """Fetch from Riot API with retry logic for rate limiting."""
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
                # Try to get error message from response body
                error_body = ""
                try:
                    error_body = response.data.decode("utf-8") if response.data else ""
                except:
                    pass
                error_msg = f"API returned status {response.status}"
                if error_body:
                    error_msg += f": {error_body}"
                raise Exception(error_msg)

        except urllib3.exceptions.HTTPError:
            if i == retries - 1:
                raise
            time.sleep(2**i)
        except Exception as e:
            if i == retries - 1:
                raise Exception(f"Request failed. Retry {i + 1}/{retries}: {e}")
            time.sleep(2**i)


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
    """Read match data from S3."""
    try:
        response = s3_client.get_object(Bucket=bucket_name, Key=key)
        json_body = response["Body"].read().decode("utf-8")
        return json.loads(json_body)
    except ClientError as e:
        raise Exception(f"Failed to read from S3: {str(e)}")


def save_to_s3(
    match_id: str, match_data: Dict[str, Any], region: str, puuid: str
) -> Dict[str, str]:
    """Save match JSON data to S3 bucket, organized by PUUID."""
    bucket_name = os.environ.get("S3_BUCKET_NAME")

    if not bucket_name:
        raise ValueError("S3_BUCKET_NAME environment variable not set")

    # Sanitize match_id for S3 key
    safe_match_id = match_id.replace("/", "_").replace(":", "_")
    # Organize by PUUID: riot/match-histories/{puuid}/{matchId}-match.json
    key = f"riot/match-histories/{puuid}/{safe_match_id}-match.json"

    try:
        json_body = json.dumps(match_data, indent=2)

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

        return {"bucket": bucket_name, "key": key, "s3Uri": f"s3://{bucket_name}/{key}"}
    except ClientError as e:
        raise Exception(f"Failed to save match to S3: {str(e)}")


def parse_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse event to extract PUUID, region, and optional parameters."""
    if "body" in event:
        body = (
            json.loads(event["body"])
            if isinstance(event["body"], str)
            else event["body"]
        )
    else:
        body = event

    puuid = body.get("puuid")
    if puuid:
        # Validate and sanitize PUUID
        puuid = str(puuid).strip()
        if not puuid or len(puuid) == 0:
            raise ValueError("PUUID cannot be empty")

        # Validate PUUID format (Riot PUUIDs are typically 78 characters, base64-like with dashes)
        puuid_pattern = re.compile(r"^[A-Za-z0-9_-]{70,80}$")
        if not puuid_pattern.match(puuid):
            raise ValueError(f"Invalid PUUID format: {puuid[:20]}...")

    return {
        "puuid": puuid,
        "region": body.get("region", "americas"),
        "start": body.get("start", "0"),
        "count": body.get("count", "20"),
        "queue": body.get("queue"),
        "startTime": body.get("startTime"),
        "endTime": body.get("endTime"),
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler function.
    Fetches match IDs and match details from Riot API.
    Expected event format: {"puuid": "...", "region": "americas", "count": "100", ...}
    """
    try:
        params = parse_event(event)

        puuid = params.get("puuid")
        if not puuid:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "puuid is required"}),
            }

        # PUUID is already validated and sanitized in parse_event
        # Ensure it's a string (should already be from parse_event)
        puuid = str(puuid).strip()
        if not puuid or len(puuid) == 0:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "puuid cannot be empty"}),
            }

        api_key = get_riot_api_key()
        headers = {"X-Riot-Token": api_key}
        bucket_name = os.environ.get("S3_BUCKET_NAME")

        # Step 1: Fetch match IDs with pagination
        # URL-encode PUUID to handle special characters
        encoded_puuid = quote(puuid, safe="")
        query_params = []
        query_params.append(f"start={params['start']}")
        query_params.append(f"count={params['count']}")
        if params.get("queue"):
            query_params.append(f"queue={params['queue']}")
        if params.get("startTime"):
            query_params.append(f"startTime={params['startTime']}")
        if params.get("endTime"):
            query_params.append(f"endTime={params['endTime']}")

        match_ids_url = (
            f"https://{params['region']}.api.riotgames.com/"
            f"lol/match/v5/matches/by-puuid/{encoded_puuid}/ids"
            f"?{'&'.join(query_params)}"
        )

        try:
            match_ids = fetch_with_retry(match_ids_url, headers)
        except Exception as e:
            print(f"Error fetching match IDs: {str(e)}")
            raise Exception(f"Failed to fetch match IDs: {str(e)}")

        if not isinstance(match_ids, list):
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "Invalid match IDs response"}),
            }

        # Step 2: Fetch match details (with S3 caching)
        matches = []
        failed_matches = []
        puuid = params["puuid"]

        for i, match_id in enumerate(match_ids):
            try:
                # Check S3 cache first (organized by PUUID)
                if bucket_name:
                    safe_match_id = match_id.replace("/", "_").replace(":", "_")
                    # Organize by PUUID: riot/match-histories/{puuid}/{matchId}-match.json
                    key = f"riot/match-histories/{puuid}/{safe_match_id}-match.json"

                    if s3_object_exists(bucket_name, key):
                        match_data = get_from_s3(bucket_name, key)
                        matches.append(match_data)
                        continue

                # Fetch from Riot API
                # URL-encode match ID to handle special characters
                encoded_match_id = quote(str(match_id), safe="")
                match_url = (
                    f"https://{params['region']}.api.riotgames.com/"
                    f"lol/match/v5/matches/{encoded_match_id}"
                )

                match_data = fetch_with_retry(match_url, headers)

                # Save to S3 cache (organized by PUUID)
                if bucket_name:
                    save_to_s3(match_id, match_data, params["region"], puuid)

                matches.append(match_data)

                # Small delay between requests to avoid rate limits
                if i < len(match_ids) - 1:
                    time.sleep(0.1)

            except Exception as e:
                failed_matches.append({"matchId": match_id, "error": str(e)})
                continue

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "matches": matches,
                    "total": len(matches),
                    "failed": failed_matches if failed_matches else None,
                }
            ),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
