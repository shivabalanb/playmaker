import { NextRequest, NextResponse } from "next/server";

// Helper function to fetch with retry logic based on Riot API rate limits
async function fetchWithRetry(
  url: string,
  apiKey: string,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": apiKey,
      },
    });

    // Log rate limit headers for debugging
    const appRateLimit = response.headers.get("X-App-Rate-Limit");
    const appRateLimitCount = response.headers.get("X-App-Rate-Limit-Count");
    const methodRateLimit = response.headers.get("X-Method-Rate-Limit");
    const methodRateLimitCount = response.headers.get(
      "X-Method-Rate-Limit-Count"
    );

    if (i === 0 && (appRateLimitCount || methodRateLimitCount)) {
      console.log(
        `[Match API] Rate limit status - App: ${appRateLimitCount}/${appRateLimit} | Method: ${methodRateLimitCount}/${methodRateLimit}`
      );
    }

    // If rate limited (429), check for Retry-After header
    if (response.status === 429 && i < retries - 1) {
      const retryAfter = response.headers.get("Retry-After");
      // Use Retry-After if provided, otherwise use more aggressive backoff
      const waitTime = retryAfter
        ? parseInt(retryAfter) * 1000 + 100 // Add 100ms buffer
        : Math.min(2000 * Math.pow(2, i), 30000); // Cap at 30 seconds

      console.warn(
        `[Match API] Rate limited (429). ${retryAfter ? `Retry-After: ${retryAfter}s` : `Exponential backoff: ${waitTime}ms`}. Attempt ${i + 1}/${retries}. URL: ${url.substring(0, 100)}`
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    // If still 429 on last attempt, log it
    if (response.status === 429 && i === retries - 1) {
      console.error(
        `[Match API] Failed after ${retries} retries. Still getting 429. App limit: ${appRateLimitCount}, Method limit: ${methodRateLimitCount}`
      );
    }

    // Return response (success or non-retryable error)
    return response;
  }

  // If all retries failed, throw error
  throw new Error("Max retries exceeded due to rate limiting");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const matchId = searchParams.get("matchId");
  const region = searchParams.get("region") || "americas";

  if (!matchId) {
    return NextResponse.json({ error: "matchId is required" }, { status: 400 });
  }

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Riot API key not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetchWithRetry(
      `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      apiKey
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Riot API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const matchData = await response.json();
    return NextResponse.json(matchData);
  } catch (error) {
    console.error("Error fetching match:", error);
    return NextResponse.json(
      { error: "Failed to fetch match data" },
      { status: 500 }
    );
  }
}
