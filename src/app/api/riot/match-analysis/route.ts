import { NextRequest, NextResponse } from "next/server";

const LAMBDA_FUNCTION_URL = process.env.LAMBDA_MATCH_ANALYSIS_FUNCTION_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.matchId) {
      return NextResponse.json(
        { error: "matchId is required in request body" },
        { status: 400 }
      );
    }

    if (!body.puuid) {
      return NextResponse.json(
        { error: "puuid is required in request body" },
        { status: 400 }
      );
    }

    // Validate and sanitize matchId
    const matchId = String(body.matchId).trim();
    if (!matchId || matchId.length === 0) {
      return NextResponse.json(
        { error: "matchId cannot be empty" },
        { status: 400 }
      );
    }

    // Validate and sanitize PUUID
    const puuid = String(body.puuid).trim();
    if (!puuid || puuid.length === 0) {
      return NextResponse.json(
        { error: "puuid cannot be empty" },
        { status: 400 }
      );
    }

    // Validate PUUID format (Riot PUUIDs are typically 78 characters, base64-like with dashes)
    const puuidPattern = /^[A-Za-z0-9_-]{70,80}$/;
    if (!puuidPattern.test(puuid)) {
      return NextResponse.json(
        { error: "Invalid PUUID format" },
        { status: 400 }
      );
    }

    if (!LAMBDA_FUNCTION_URL) {
      return NextResponse.json(
        { error: "Lambda Function URL not configured" },
        { status: 500 }
      );
    }

    // Call Lambda - send everything as body parameters
    const lambdaResponse = await fetch(LAMBDA_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        matchId: matchId,
        region: body.region || "americas",
        puuid: puuid,
      }),
    });

    if (!lambdaResponse.ok) {
      const errorText = await lambdaResponse.text();
      return NextResponse.json(
        {
          error: `Lambda Function error: ${lambdaResponse.status}`,
          details: errorText,
        },
        { status: lambdaResponse.status }
      );
    }

    // Function URL returns the Lambda body directly as JSON
    const analysis = await lambdaResponse.json();

    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    console.error("Error fetching match analysis:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch match analysis",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
