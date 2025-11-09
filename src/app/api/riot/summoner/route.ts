import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const puuid = searchParams.get("puuid");
  const platform = searchParams.get("platform") || "na1"; // Platform region (na1, euw1, kr, etc.)

  if (!puuid) {
    return NextResponse.json({ error: "puuid is required" }, { status: 400 });
  }

  // Validate and sanitize PUUID
  const sanitizedPuuid = String(puuid).trim();
  if (!sanitizedPuuid || sanitizedPuuid.length === 0) {
    return NextResponse.json(
      { error: "puuid cannot be empty" },
      { status: 400 }
    );
  }

  // URL-encode PUUID to handle special characters in path
  const encodedPuuid = encodeURIComponent(sanitizedPuuid);

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Riot API key not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodedPuuid}`,
      {
        headers: {
          "X-Riot-Token": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Riot API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching summoner:", error);
    return NextResponse.json(
      { error: "Failed to fetch summoner data" },
      { status: 500 }
    );
  }
}
