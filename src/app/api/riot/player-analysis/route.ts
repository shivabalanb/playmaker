import { NextRequest, NextResponse } from "next/server";

const LAMBDA_FUNCTION_URL = process.env.LAMBDA_PLAYER_ANALYSIS_FUNCTION_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.puuid) {
      return NextResponse.json(
        { error: "puuid is required in request body" },
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
    // Format: alphanumeric, dashes, underscores, typically 70-80 characters
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

    // Call Lambda - it will fetch matches itself
    const lambdaResponse = await fetch(LAMBDA_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        puuid: puuid,
        region: body.region || "americas",
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
    const stats = await lambdaResponse.json();

    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    console.error("Error fetching player analysis:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch player analysis",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
