"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ComparisonView } from "./components/ComparisonView";
import { LoadingState } from "./components/LoadingState";

interface RecapData {
  stats?: any;
  insights?: any;
}

interface ComparisonData {
  player1: {
    puuid: string;
    summonerName?: string;
    recap: RecapData;
  };
  player2: {
    puuid: string;
    summonerName?: string;
    recap: RecapData;
  };
}

export default function ComparePage() {
  const searchParams = useSearchParams();
  const puuid1 = searchParams.get("puuid1");
  const puuid2 = searchParams.get("puuid2");
  const region = searchParams.get("region") || "americas";
  const name1 = searchParams.get("name1"); // Optional: player 1 name
  const name2 = searchParams.get("name2"); // Optional: player 2 name

  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "error">("loading");
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("Checking recap status...");

  useEffect(() => {
    if (!puuid1 || !puuid2) {
      setError("Missing player information");
      setStatus("error");
      return;
    }

    const loadComparison = async () => {
      try {
        // Step 1: Check both recap statuses
        setProgress("Checking both recaps...");
        
        const [status1Res, status2Res] = await Promise.all([
          fetch(`/api/riot/recap/status?puuid=${puuid1}&region=${region}`),
          fetch(`/api/riot/recap/status?puuid=${puuid2}&region=${region}`),
        ]);

        if (!status1Res.ok || !status2Res.ok) {
          throw new Error("Failed to check recap status");
        }

        const status1 = await status1Res.json();
        const status2 = await status2Res.json();

        // Check if either is not eligible
        if (status1.status === "not_eligible") {
          throw new Error(`You need at least 100 games to generate a recap`);
        }
        if (status2.status === "not_eligible") {
          throw new Error(`Your friend needs at least 100 games to generate a recap`);
        }

        // Check if either recap is still processing
        if (status1.status === "processing" || status2.status === "processing") {
          setProgress(
            status1.status === "processing" && status2.status === "processing"
              ? "Generating both recaps... Please refresh in a moment."
              : status1.status === "processing"
                ? "Generating your recap... Please refresh in a moment."
                : "Generating friend's recap... Please refresh in a moment."
          );
          setStatus("processing");
          return;
        }

        // Both recaps are ready, now check comparison status
        if (status1.status === "available" && status2.status === "available") {
          setProgress("Checking comparison status...");
          
          // Check comparison status
          const compStatusRes = await fetch(
            `/api/riot/recap/compare/status?puuid1=${puuid1}&puuid2=${puuid2}`
          );
          
          if (!compStatusRes.ok) {
            throw new Error("Failed to check comparison status");
          }
          
          const compStatus = await compStatusRes.json();
          
          // If comparison is available, fetch it
          if (compStatus.status === "available") {
            setProgress("Loading comparison...");
            
            const compRes = await fetch(
              `/api/riot/recap/compare?puuid1=${puuid1}&puuid2=${puuid2}&region=${region}`
            );
            
            if (compRes.ok) {
              const data = await compRes.json();
              if (data.status === "available") {
                setComparisonData(data.data);
                setStatus("ready");
                return;
              }
            }
          }
          
          // If comparison is processing, show message
          if (compStatus.status === "processing") {
            setProgress("Generating comparison insights... Please refresh in a moment.");
            setStatus("processing");
            return;
          }
          
          // Comparison doesn't exist, trigger generation
          if (compStatus.status === "not_found") {
            // Use names from URL params if available, otherwise throw error
            if (!name1 || !name2) {
              throw new Error("Summoner names are required to generate comparison. Please start from the recap page.");
            }
            
            console.log("[Compare] Using names from URL:", name1, "vs", name2);
            console.log("[Compare] PUUIDs:", puuid1, "vs", puuid2);
            console.log("[Compare] Are PUUIDs the same?", puuid1 === puuid2);
            
            setProgress("Generating comparison insights...");
            
            const generateRes = await fetch("/api/riot/recap/compare/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                puuid1,
                puuid2,
                region,
                player1Name: name1,
                player2Name: name2,
              }),
            });
            
            if (!generateRes.ok) {
              const errorData = await generateRes.json();
              throw new Error(errorData.error || "Failed to generate comparison");
            }
            
            setProgress("Generating comparison insights... Please refresh in a moment.");
            setStatus("processing");
            return;
          }
        }
      } catch (err) {
        console.error("Error loading comparison:", err);
        setError(err instanceof Error ? err.message : "Failed to load comparison");
        setStatus("error");
      }
    };

    loadComparison();
  }, [puuid1, puuid2, region]);

  if (status === "loading" || status === "processing") {
    return <LoadingState message={progress} />;
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!comparisonData) {
    return null;
  }

  return <ComparisonView data={comparisonData} region={region} />;
}
