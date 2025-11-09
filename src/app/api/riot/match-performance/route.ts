import { NextRequest, NextResponse } from "next/server";

const LAMBDA_FUNCTION_URL = process.env.LAMBDA_MATCH_PERFORMANCE_FUNCTION_URL;

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

    if (!LAMBDA_FUNCTION_URL) {
      return NextResponse.json(
        { error: "Lambda Function URL not configured" },
        { status: 500 }
      );
    }

    // Call Lambda
    const lambdaResponse = await fetch(LAMBDA_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        matchId: body.matchId,
        region: body.region || "americas",
        puuid: body.puuid,
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
    console.error("Error fetching match performance:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch match performance",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
