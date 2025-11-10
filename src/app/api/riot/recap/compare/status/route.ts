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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const puuid1 = searchParams.get("puuid1");
    const puuid2 = searchParams.get("puuid2");

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

    const comparisonKey = `riot/comparisons/${puuid1}-vs-${puuid2}-latest.json`;
    const processingKey = `riot/comparisons/${puuid1}-vs-${puuid2}-processing.json`;

    // Check if comparison already exists
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: comparisonKey,
      });
      await s3Client.send(command);
      
      return NextResponse.json({
        status: "available",
        message: "Comparison is ready",
      });
    } catch (error: any) {
      if (error.name !== "NoSuchKey" && error.$metadata?.httpStatusCode !== 404) {
        throw error;
      }
    }

    // Check if comparison is being generated
    try {
      const processingCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: processingKey,
      });
      const processingResponse = await s3Client.send(processingCommand);
      const processingText = await processingResponse.Body!.transformToString();
      const processingData = JSON.parse(processingText);

      // Check if processing started recently (within last 10 minutes)
      const processingStartTime = processingData.startedAt || 0;
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

      if (processingStartTime > tenMinutesAgo) {
        return NextResponse.json({
          status: "processing",
          message: "Comparison is being generated",
        });
      }
      // Processing marker is stale, treat as not found
    } catch (error: any) {
      if (error.name !== "NoSuchKey" && error.$metadata?.httpStatusCode !== 404) {
        console.warn("Error checking processing status:", error);
      }
    }

    // Comparison doesn't exist and isn't being generated
    return NextResponse.json({
      status: "not_found",
      message: "Comparison not generated yet",
    });
  } catch (error) {
    console.error("Error checking comparison status:", error);
    return NextResponse.json(
      {
        error: "Failed to check comparison status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
