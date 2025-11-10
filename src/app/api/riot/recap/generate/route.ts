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
const LAMBDA_FUNCTION_URL = process.env.LAMBDA_SEASON_RECAP_FUNCTION_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { puuid, region } = body;

    if (!puuid) {
      return NextResponse.json({ error: "puuid is required" }, { status: 400 });
    }

    if (!BUCKET_NAME) {
      return NextResponse.json(
        { error: "S3_BUCKET_NAME not configured" },
        { status: 500 }
      );
    }

    if (!LAMBDA_FUNCTION_URL) {
      return NextResponse.json(
        { error: "Lambda Function URL not configured" },
        { status: 500 }
      );
    }

    // URL encode PUUID for S3 key (similar to other routes)
    const encodedPuuid = encodeURIComponent(puuid);
    const processingKey = `riot/season-recaps/${encodedPuuid}-processing.json`;
    const cacheKey = `riot/season-recaps/${encodedPuuid}-latest.json`;

    // Check if already processing
    try {
      const processingCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: processingKey,
      });
      await s3Client.send(processingCommand);
      return NextResponse.json({
        status: "processing",
        message: "Recap generation is already in progress",
      });
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name !== "NoSuchKey" && err.$metadata?.httpStatusCode !== 404) {
        console.error("Error checking processing status:", error);
        throw error;
      }
      // Not processing, continue
    }

    // Check if recap already exists
    try {
      const cacheCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: cacheKey,
      });
      await s3Client.send(cacheCommand);
      return NextResponse.json({
        status: "available",
        message: "Recap already exists",
      });
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err.name !== "NoSuchKey" && err.$metadata?.httpStatusCode !== 404) {
        console.error("Error checking cache:", error);
        throw error;
      }
      // No recap exists, continue
    }

    // Invoke Lambda asynchronously
    // Lambda will create the processing marker itself (has write access)
    console.log(`[Generate] Invoking Lambda for PUUID: ${puuid}, Region: ${region || "americas"}`);
    
    fetch(LAMBDA_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        puuid,
        region: region || "americas",
      }),
    })
      .then((response) => {
        console.log(`[Generate] Lambda invocation response status: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        console.log(`[Generate] Lambda response: ${text}`);
      })
      .catch((error) => {
        console.error("[Generate] Failed to invoke Lambda:", error);
        // Note: Can't clean up processing marker here - Lambda handles it
      });

    return NextResponse.json({ status: "processing" });
  } catch (error) {
    console.error("Error generating recap:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = {
      error: "Failed to generate recap",
      details: errorMessage,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    };
    return NextResponse.json(errorDetails, { status: 500 });
  }
}
