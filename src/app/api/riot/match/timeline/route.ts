import { NextRequest, NextResponse } from "next/server";

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

      console.warn(
        `[Match Timeline API] Rate limited (429). Attempt ${i + 1}/${retries}`,
        {
          url: url.substring(0, 100),
          retryAfter: retryAfter ? `${retryAfter}s` : "not provided",
          waitTime: `${waitTime}ms`,
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

    if (!body.matches || !Array.isArray(body.matches)) {
      return NextResponse.json(
        { error: "matches array is required in request body" },
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

    const matchRequests: Array<{ matchId: string; region: string }> =
      body.matches;

    // Fetch timeline data in parallel for speed
    const timelinePromises = matchRequests.map(({ matchId, region }) =>
      fetchWithRetry(
        `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`,
        apiKey
      )
        .then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `Failed to fetch timeline ${matchId}: ${response.status} - ${errorText}`
            );
            return { matchId, success: false, error: errorText };
          }
          const timelineData = await response.json();
          return { matchId, success: true, timelineData };
        })
        .catch((error) => {
          console.error(`Error fetching timeline ${matchId}:`, error);
          return {
            matchId,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        })
    );

    const results = await Promise.all(timelinePromises);

    return NextResponse.json({
      results: results,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    console.error("Error fetching timeline data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch timeline data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
