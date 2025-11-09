import { NextRequest, NextResponse } from "next/server";

const LAMBDA_FUNCTION_URL =
  process.env.LAMBDA_PLAYER_PERFORMANCE_FUNCTION_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.puuid) {
      return NextResponse.json(
        { error: "puuid is required in request body" },
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
        puuid: body.puuid,
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
    console.error("Error fetching match stats:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch match stats",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
