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
        ? parseInt(retryAfter) * 1000 + 100
        : Math.min(2000 * Math.pow(2, i), 30000);

      console.warn(
        `[Timeline API] Rate limited (429). Retry after ${waitTime}ms. Attempt ${i + 1}/${retries}`
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    return response;
  }

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
      `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`,
      apiKey
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Riot API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const timelineData = await response.json();
    return NextResponse.json(timelineData);
  } catch (error) {
    console.error("Error fetching timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline data" },
      { status: 500 }
    );
  }
}

