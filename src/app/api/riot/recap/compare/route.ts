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
    const region = searchParams.get("region") || "americas";

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

    // Check if comparison already exists in S3
    const comparisonKey = `riot/comparisons/${puuid1}-vs-${puuid2}-latest.json`;
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: comparisonKey,
      });
      const response = await s3Client.send(command);
      const text = await response.Body!.transformToString();
      const comparisonData = JSON.parse(text);
      
      return NextResponse.json({
        status: "available",
        data: comparisonData,
      });
    } catch (error: any) {
      if (error.name !== "NoSuchKey" && error.$metadata?.httpStatusCode !== 404) {
        throw error;
      }
      // Comparison doesn't exist, return not found
      return NextResponse.json(
        { status: "not_found", message: "Comparison not generated yet" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error fetching comparison data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch comparison data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
