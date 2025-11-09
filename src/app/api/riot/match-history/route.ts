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

    // If rate limited (429), check for Retry-After header
    if (response.status === 429 && i < retries - 1) {
      const retryAfter = response.headers.get("Retry-After");
      const waitTime = retryAfter
        ? parseInt(retryAfter) * 1000 + 100 // Add 100ms buffer
        : Math.min(2000 * Math.pow(2, i), 30000); // Cap at 30 seconds

      // Log all rate limit headers for debugging
      const rateLimitHeaders = {
        "Retry-After": retryAfter,
        "X-App-Rate-Limit": response.headers.get("X-App-Rate-Limit"),
        "X-App-Rate-Limit-Count": response.headers.get(
          "X-App-Rate-Limit-Count"
        ),
        "X-Method-Rate-Limit": response.headers.get("X-Method-Rate-Limit"),
        "X-Method-Rate-Limit-Count": response.headers.get(
          "X-Method-Rate-Limit-Count"
        ),
      };

      console.warn(
        `[Match History API] Rate limited (429). Attempt ${i + 1}/${retries}`,
        {
          url: url.substring(0, 100), // Log first 100 chars of URL
          retryAfter: retryAfter ? `${retryAfter}s` : "not provided",
          waitTime: `${waitTime}ms`,
          rateLimitHeaders,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    // Return response (success or non-retryable error)
    return response;
  }

  // If all retries failed, throw error
  throw new Error("Max retries exceeded due to rate limiting");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.puuid) {
      return NextResponse.json(
        { error: "puuid is required in request body" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Riot API key not configured" },
        { status: 500 }
      );
    }

    const region = body.region || "americas";
    const start = body.start || "0";
    const count = body.count || "20";

    // Step 1: Fetch match IDs
    const queryParams = new URLSearchParams();
    queryParams.append("start", start);
    queryParams.append("count", count);
    if (body.queue) queryParams.append("queue", body.queue);
    if (body.startTime) queryParams.append("startTime", body.startTime);
    if (body.endTime) queryParams.append("endTime", body.endTime);

    const matchIdsResponse = await fetchWithRetry(
      `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${body.puuid}/ids?${queryParams.toString()}`,
      apiKey
    );

    if (!matchIdsResponse.ok) {
      const errorText = await matchIdsResponse.text();
      return NextResponse.json(
        {
          error: `Riot API error: ${matchIdsResponse.status}`,
          details: errorText,
        },
        { status: matchIdsResponse.status }
      );
    }

    const matchIds: string[] = await matchIdsResponse.json();

    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return NextResponse.json({
        matches: [],
        total: 0,
      });
    }

    // Step 2: Fetch match details in parallel for speed
    const matchPromises = matchIds.map((matchId) =>
      fetchWithRetry(
        `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        apiKey
      )
        .then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `Failed to fetch match ${matchId}: ${response.status} - ${errorText}`
            );
            return null;
          }
          return response.json();
        })
        .catch((error) => {
          console.error(`Error fetching match ${matchId}:`, error);
          return null;
        })
    );

    const matches = await Promise.all(matchPromises);

    // Filter out any failed matches (null values)
    const validMatches = matches.filter((match) => match !== null);

    return NextResponse.json({
      matches: validMatches,
      total: validMatches.length,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    console.error("Error fetching match history:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch match history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
