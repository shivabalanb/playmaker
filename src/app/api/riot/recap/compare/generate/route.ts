import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const LAMBDA_COMPARISON_URL = process.env.LAMBDA_COMPARISON_FUNCTION_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { puuid1, puuid2, region, player1Name, player2Name } = body;

    if (!puuid1 || !puuid2) {
      return NextResponse.json(
        { error: "Both puuid1 and puuid2 are required" },
        { status: 400 }
      );
    }

    if (!BUCKET_NAME) {
      return NextResponse.json(
        { error: "S3_BUCKET_NAME not configured" },
        { status: 500 }
      );
    }

    if (!LAMBDA_COMPARISON_URL) {
      return NextResponse.json(
        { error: "Lambda Comparison Function URL not configured" },
        { status: 500 }
      );
    }

    const comparisonKey = `riot/comparisons/${puuid1}-vs-${puuid2}-latest.json`;
    const processingKey = `riot/comparisons/${puuid1}-vs-${puuid2}-processing.json`;

    // Check if already processing
    try {
      const processingCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: processingKey,
      });
      await s3Client.send(processingCommand);
      return NextResponse.json({
        status: "processing",
        message: "Comparison generation is already in progress",
      });
    } catch (error: any) {
      if (error.name !== "NoSuchKey" && error.$metadata?.httpStatusCode !== 404) {
        console.error("Error checking processing status:", error);
        throw error;
      }
    }

    // Check if comparison already exists
    try {
      const cacheCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: comparisonKey,
      });
      await s3Client.send(cacheCommand);
      return NextResponse.json({
        status: "available",
        message: "Comparison already exists",
      });
    } catch (error: any) {
      if (error.name !== "NoSuchKey" && error.$metadata?.httpStatusCode !== 404) {
        console.error("Error checking cache:", error);
        throw error;
      }
    }

    // Invoke Lambda asynchronously
    console.log(`[Compare Generate] Invoking Lambda for ${puuid1} vs ${puuid2}`);
    
    fetch(LAMBDA_COMPARISON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        puuid1,
        puuid2,
        region: region || "americas",
        player1Name: player1Name || "Player 1",
        player2Name: player2Name || "Player 2",
      }),
    })
      .then((response) => {
        console.log(`[Compare Generate] Lambda response status: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        console.log(`[Compare Generate] Lambda response: ${text}`);
      })
      .catch((error) => {
        console.error("[Compare Generate] Failed to invoke Lambda:", error);
      });

    return NextResponse.json({ status: "processing" });
  } catch (error) {
    console.error("Error generating comparison:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to generate comparison",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
