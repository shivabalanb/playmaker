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
        ? parseInt(retryAfter) * 1000 // Convert seconds to milliseconds
        : 1000 * Math.pow(2, i); // Fallback to exponential backoff

      console.warn(
        `[Matches API] Rate limited (429). ${retryAfter ? `Waiting ${retryAfter}s as instructed` : `Using exponential backoff ${waitTime}ms`}. Attempt ${i + 1}/${retries}`
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const puuid = searchParams.get("puuid");
  const region = searchParams.get("region") || "americas";
  const count = searchParams.get("count") || "20"; // Default to 100 (max per request)
  const queue = searchParams.get("queue"); // Filter by queue ID (e.g., 420 for ranked solo)
  const startTime = searchParams.get("startTime"); // Epoch seconds for season start
  const endTime = searchParams.get("endTime"); // Epoch seconds for season end

  if (!puuid) {
    return NextResponse.json({ error: "puuid is required" }, { status: 400 });
  }

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Riot API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append("count", count);
    if (queue) queryParams.append("queue", queue);
    if (startTime) queryParams.append("startTime", startTime);
    if (endTime) queryParams.append("endTime", endTime);

    const response = await fetchWithRetry(
      `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${queryParams.toString()}`,
      apiKey
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Riot API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const matchIds = await response.json();
    return NextResponse.json({ matchIds });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch match data" },
      { status: 500 }
    );
  }
}
