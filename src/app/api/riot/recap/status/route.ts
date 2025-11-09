import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const RIOT_API_KEY = process.env.RIOT_API_KEY;

const MIN_GAMES_REQUIRED = 100;

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": RIOT_API_KEY!,
      },
    });

    if (response.status === 429 && i < retries - 1) {
      const retryAfter = response.headers.get("Retry-After");
      const waitTime = retryAfter
        ? parseInt(retryAfter) * 1000 + 100
        : Math.min(2000 * Math.pow(2, i), 30000);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    return response;
  }
  throw new Error("Max retries exceeded");
}

async function checkEligibility(
  puuid: string,
  region: string
): Promise<{ eligible: boolean; gameCount: number }> {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY not configured");
  }

  // Fetch match IDs (max 100 per API request)
  // Use encodeURIComponent exactly like match-history route does
  const encodedPuuid = encodeURIComponent(puuid);
  const matchIdsUrl = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodedPuuid}/ids?start=0&count=100`;

  const response = await fetchWithRetry(matchIdsUrl);
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[ERROR] Riot API returned ${response.status}:`, errorText);
    throw new Error(
      `Failed to fetch match IDs: ${response.status}${errorText ? ` - ${errorText}` : ""}`
    );
  }

  const matchIds: string[] = await response.json();
  if (!Array.isArray(matchIds)) {
    return { eligible: false, gameCount: 0 };
  }

  // If we got 100 match IDs, user is eligible (doesn't matter which season)
  const gameCount = matchIds.length;
  return {
    eligible: gameCount >= MIN_GAMES_REQUIRED,
    gameCount,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const puuid = searchParams.get("puuid");
    const region = searchParams.get("region") || "americas";

    if (!puuid) {
      return NextResponse.json({ error: "puuid required" }, { status: 400 });
    }

    if (!BUCKET_NAME) {
      return NextResponse.json(
        { error: "S3_BUCKET_NAME not configured" },
        { status: 500 }
      );
    }

    // Step 1: Check if recap data exists (simplest check first)
    const cacheKey = `riot/season-recaps/${puuid}-latest.json`;
    try {
      const cacheCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: cacheKey,
      });
      const cacheResponse = await s3Client.send(cacheCommand);
      const cacheText = await cacheResponse.Body!.transformToString();
      const cachedRecap = JSON.parse(cacheText);

      // Data exists - return it
      return NextResponse.json({
        status: "available",
        data: cachedRecap,
        cached: true,
      });
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        // Data doesn't exist - check if processing
      } else {
        throw error;
      }
    }

    // Step 1.5: Check if recap is currently being generated
    const processingKey = `riot/season-recaps/${puuid}-processing.json`;
    try {
      const processingCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: processingKey,
      });
      const processingResponse = await s3Client.send(processingCommand);
      const processingText = await processingResponse.Body!.transformToString();
      const processingData = JSON.parse(processingText);

      // Check if processing started recently (within last 30 minutes)
      const processingStartTime = processingData.startedAt || 0;
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

      if (processingStartTime > thirtyMinutesAgo) {
        return NextResponse.json({
          status: "processing",
          message: "Recap is currently being generated. Please wait...",
        });
      }
      // Processing marker is stale (older than 30 min), continue to eligibility check
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        // No processing marker - continue to eligibility check
      } else {
        // Log but continue
        console.warn("Error checking processing status:", error);
      }
    }

    // Step 2: Check eligibility (only if data doesn't exist)
    let eligibility;
    try {
      eligibility = await checkEligibility(puuid, region);
    } catch (error) {
      console.error("Error checking eligibility:", error);
      return NextResponse.json(
        {
          error: "Failed to check eligibility",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    if (!eligibility.eligible) {
      return NextResponse.json({
        status: "not_eligible",
        message: `You need at least ${MIN_GAMES_REQUIRED} games. You have ${eligibility.gameCount} games.`,
        gameCount: eligibility.gameCount,
        required: MIN_GAMES_REQUIRED,
      });
    }

    // Eligible but no data - ready to generate
    return NextResponse.json({
      status: "eligible",
      message: "Recap not found. Ready to generate.",
      gameCount: eligibility.gameCount,
    });
  } catch (error) {
    console.error("Error checking status:", error);
    return NextResponse.json(
      {
        error: "Failed to check status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
