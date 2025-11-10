"use client";

import { useEffect, useState, use, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  SummonerHeader,
  MatchCard,
  type MatchData,
  type SummonerData,
  type RankData,
} from "@/app/components/summoner";
import {
  getChampionImageUrl,
  getItemImageUrl,
  getProfileIconUrl,
  getRankEmblemUrl,
  getQueueType,
  isRankedQueue,
  isReviewableQueue,
  isSwarmQueue,
  getPlatformRegion,
  reorderItemsWithBootsFirst,
  formatDuration,
  formatTimeAgo,
  getChampionNameById,
} from "@/lib";
import { useDisplayedMatches } from "@/contexts/DisplayedMatchesContext";
import { useWebSocket } from "@/contexts/WebSocketContext";

export default function SummonerPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const COUNT = 10;
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const puuid = searchParams.get("puuid");
  const region = searchParams.get("region") || "americas";
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);
  const [recapStatus, setRecapStatus] = useState<
    "not_eligible" | "eligible" | "available" | "loading" | "processing"
  >("loading");
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [summonerData, setSummonerData] = useState<SummonerData | null>(null);
  const [rankData, setRankData] = useState<RankData | null>(null);
  const [highestMasteryChampionName, setHighestMasteryChampionName] =
    useState<string>("Yasuo");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMoreMatches, setHasMoreMatches] = useState(true);
  const [currentStart, setCurrentStart] = useState(0);
  const [resolvedPuuid, setResolvedPuuid] = useState<string | null>(puuid);
  const lastLoadMoreTimeRef = useRef<number>(0);
  const MIN_LOAD_MORE_DELAY_MS = 1000; // Minimum 1 second between load more calls
  
  const { displayedMatchIds, setDisplayedMatchIds } = useDisplayedMatches();
  const { startIngestionPolling, setIngesting } = useWebSocket();
  
  // Cache key for localStorage
  const CACHE_KEY = `match-history-${puuid}-${region}`;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Cleanup old localStorage entries to free up space
  const cleanupOldCaches = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('match-history-')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            const age = Date.now() - (data.timestamp || 0);
            // Remove caches older than 1 hour
            if (age > 60 * 60 * 1000) {
              keysToRemove.push(key);
            }
          } catch (e) {
            // If we can't parse it, remove it
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          console.log(`[Cleanup] Removed old cache: ${key}`);
        } catch (e) {
          // Ignore errors
        }
      });
    } catch (e) {
      console.warn('[Cleanup] Failed to cleanup old caches:', e);
    }
  };
  
  // Update displayed match IDs whenever matches change
  useEffect(() => {
    const matchIds = matches.map((match) => match.metadata.matchId);
    setDisplayedMatchIds(matchIds);
  }, [matches, setDisplayedMatchIds]);

  // Automatically fetch timeline data for all loaded matches
  useEffect(() => {
    if (matches.length === 0) return;

    const fetchTimelinesForMatches = async () => {
      // Get current timestamp for polling (subtract 5 seconds to account for processing delay)
      const uploadTime = new Date(Date.now() - 5000).toISOString();
      console.log('Upload time for polling:', uploadTime);
      let needsPolling = false;
      
      // Fetch timeline data for each match with a small delay between requests
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        
        // Add a small delay between requests to avoid rate limiting (100ms)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
          const response = await fetch(process.env.NEXT_PUBLIC_PARSE_ENDPOINT!, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              matchId: match.metadata.matchId,
              region: region,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Check if data was already cached
            const summary = data.summary || {};
            const allCached = summary.cached > 0 && summary.processed === 0;
            
            if (!allCached) {
              needsPolling = true;
              // Set ingesting as soon as we detect processing is needed
              setIngesting(true);
            }
            
            console.log(`Timeline parse response for ${match.metadata.matchId}:`, {
              cached: summary.cached || 0,
              processed: summary.processed || 0,
              needsPolling: !allCached
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch timeline for ${match.metadata.matchId}:`, error);
        }
      }
      
      // Only start polling if at least one match needs processing
      if (needsPolling) {
        console.log('Starting ingestion polling - matches need processing');
        startIngestionPolling(uploadTime);
      } else {
        console.log('All matches cached - chat ready immediately');
      }
    };

    fetchTimelinesForMatches();
  }, [matches, region, startIngestionPolling, setIngesting]);
  // Match stats for AI insights (will be used for LLM context)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [matchStats, setMatchStats] = useState<Record<string, unknown> | null>(
    null
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Decode summoner name
  const decodedName = decodeURIComponent(resolvedParams.name).replace("-", "#");

  // Helper function to filter valid matches
  const filterValidMatches = (matches: MatchData[]): MatchData[] => {
    return matches.filter(
      (match: MatchData): match is MatchData =>
        match !== null &&
        match.info !== undefined &&
        match.info.participants !== undefined &&
        Array.isArray(match.info.participants) &&
        !isSwarmQueue(match.info.queueId)
    );
  };

  useEffect(() => {
    console.log("PUUID from URL:", puuid);
    console.log("Region from URL:", region);
    console.log("Decoded Name:", decodedName);

    // Reset pagination state when summoner changes
    setMatches([]);
    setCurrentStart(0);
    setHasMoreMatches(true);
    setIsLoading(true);

    const fetchSummonerData = async () => {
      let actualPuuid = puuid;
      
      // If no PUUID provided, look it up from Riot ID (name#tag)
      if (!puuid) {
        try {
          const [gameName, tagLine] = decodedName.split('#');
          if (!gameName || !tagLine) {
            setError("Invalid Riot ID format. Expected: GameName#TAG");
            setIsLoading(false);
            return;
          }
          
          console.log(`Looking up PUUID for ${gameName}#${tagLine}`);
          
          // Fetch PUUID from Riot ID
          const accountResponse = await fetch(
            `/api/riot/account?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&region=${region}`
          );
          
          if (!accountResponse.ok) {
            setError("Summoner not found");
            setIsLoading(false);
            return;
          }
          
          const accountData = await accountResponse.json();
          actualPuuid = accountData.puuid;
          console.log("Found PUUID:", actualPuuid);
          
          // Store resolved PUUID in state
          setResolvedPuuid(actualPuuid);
          
          // Update URL with PUUID to maintain consistency
          const url = new URL(window.location.href);
          url.searchParams.set('puuid', actualPuuid);
          window.history.replaceState({}, '', url.toString());
        } catch (err) {
          console.error("Error looking up PUUID:", err);
          setError("Failed to look up summoner");
          setIsLoading(false);
          return;
        }
      } else {
        // Store the PUUID from URL in state
        setResolvedPuuid(actualPuuid);
      }
      
      if (!actualPuuid) {
        setError("No summoner information available");
        setIsLoading(false);
        return;
      }
      try {
        const platform = getPlatformRegion(region);

        // Fetch summoner data (profile icon, level)
        const response = await fetch(
          `/api/riot/summoner?puuid=${actualPuuid}&platform=${platform}`
        );

        if (response.ok) {
          const data = await response.json();
          setSummonerData({
            profileIconId: data.profileIconId,
            summonerLevel: data.summonerLevel,
            id: data.id,
          });
        }

        // Fetch rank data using PUUID (better rate limits: 20,000 req/10s)
        const rankResponse = await fetch(
          `/api/riot/league?puuid=${actualPuuid}&platform=${platform}`
        );
        if (rankResponse.ok) {
          const rankData = await rankResponse.json();
          // Find ranked solo queue data
          const soloQueue = rankData.find(
            (entry: {
              queueType: string;
              tier: string;
              rank: string;
              leaguePoints: number;
              wins: number;
              losses: number;
            }) => entry.queueType === "RANKED_SOLO_5x5"
          );
          if (soloQueue) {
            setRankData({
              tier: soloQueue.tier,
              rank: soloQueue.rank,
              leaguePoints: soloQueue.leaguePoints,
              wins: soloQueue.wins,
              losses: soloQueue.losses,
            });
          }
        }

        // Fetch highest mastery champion (best indicator of favorite champion)
        const masteryResponse = await fetch(
          `/api/riot/mastery?puuid=${actualPuuid}&platform=${platform}`
        );
        if (masteryResponse.ok) {
          const masteryData = await masteryResponse.json();
          // API returns array sorted by mastery points (highest first)
          if (masteryData.length > 0) {
            const championId = masteryData[0].championId;
            // Map championId to championName
            const championName = await getChampionNameById(championId);
            if (championName) {
              setHighestMasteryChampionName(championName);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch summoner data:", err);
      }
    };

    // Fetch match history with pagination
    const fetchMatchHistory = async (
      start: number = 0,
      append: boolean = false
    ) => {
      if (!resolvedPuuid) return;

      try {
        if (append) {
          setIsLoadingMore(true);
        }

        // Fetch matches via Lambda with pagination
        const response = await fetch(`/api/riot/match-history`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            puuid: resolvedPuuid,
            region,
            start: start.toString(),
            count: COUNT.toString(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch match history");
        }

        const { matches: newMatches } = await response.json();
        const validMatches = filterValidMatches(newMatches);

        if (append) {
          const updatedMatches = [...matches, ...validMatches];
          setMatches(updatedMatches);
          
          // Update cache with appended matches (limit to first 20 matches to avoid quota)
          try {
            const matchesToCache = updatedMatches.slice(0, 20);
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({
                matches: matchesToCache,
                timestamp: Date.now(),
                start: start + validMatches.length,
              })
            );
          } catch (cacheError) {
            console.warn('[Summoner Page] Failed to cache matches (quota exceeded):', cacheError);
            // Clear old caches and current cache if quota exceeded
            cleanupOldCaches();
            try {
              localStorage.removeItem(CACHE_KEY);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        } else {
          setMatches(validMatches);
          
          // Cache initial load (limit to first 20 matches to avoid quota)
          try {
            const matchesToCache = validMatches.slice(0, 20);
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({
                matches: matchesToCache,
                timestamp: Date.now(),
                start: start + validMatches.length,
              })
            );
          } catch (cacheError) {
            console.warn('[Summoner Page] Failed to cache matches (quota exceeded):', cacheError);
            // Clear old caches and current cache if quota exceeded
            cleanupOldCaches();
            try {
              localStorage.removeItem(CACHE_KEY);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }

        setHasMoreMatches(validMatches.length === COUNT);
        setCurrentStart(start + validMatches.length);
        
        console.log(`[Summoner Page] ✅ Loaded ${validMatches.length} matches (total: ${append ? matches.length + validMatches.length : validMatches.length})`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load matches");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    // Fetch match stats for last 20 games
    const fetchPlayerAnalysis = async () => {
      setIsLoadingAnalysis(true);
      try {
        const response = await fetch(`/api/riot/player-analysis`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            puuid,
            region,
          }),
        });

        if (response.ok) {
          const stats = await response.json();
          setMatchStats(stats);
          console.log("Match stats loaded:", stats);
        } else {
          console.error("Failed to fetch match stats:", response.status);
        }
      } catch (err) {
        console.error("Error fetching match stats:", err);
      } finally {
        setIsLoadingAnalysis(false);
      }
    };

    // Check cache before making API calls
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      try {
        const { matches: cachedMatches, timestamp, start } = JSON.parse(cachedData);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_DURATION) {
          console.log(`[Summoner Page] 📦 Using cached match data (${Math.round(age / 1000)}s old)`);
          setMatches(cachedMatches);
          setCurrentStart(start);
          setHasMoreMatches(cachedMatches.length >= COUNT);
          setIsLoading(false);
          
          // Still fetch fresh summoner data and analysis
          fetchSummonerData();
          fetchPlayerAnalysis();
          return;
        } else {
          console.log(`[Summoner Page] 🗑️ Cache expired, fetching fresh data...`);
          localStorage.removeItem(CACHE_KEY);
        }
      } catch (err) {
        console.error("Failed to parse cached data:", err);
        localStorage.removeItem(CACHE_KEY);
      }
    }

    // No cache or expired - fetch everything
    console.log(`[Summoner Page] 🔄 Loading initial data for ${decodedName}`);
    fetchSummonerData();
    console.log(`[Summoner Page] 📥 Fetching initial 10 matches...`);
    fetchMatchHistory(0, false);
    fetchPlayerAnalysis();
  }, [puuid, region]);

  // Check recap status on page load
  useEffect(() => {
    if (!resolvedPuuid) {
      setRecapStatus("loading");
      return;
    }

    const checkRecapStatus = async () => {
      try {
        const statusRes = await fetch(
          `/api/riot/recap/status?puuid=${resolvedPuuid}&region=${region}`
        );
        const statusData = await statusRes.json();

        // Handle error response
        if (statusData.error) {
          console.error("Error checking recap status:", statusData);
          // If there's an error but we might have a cached recap, try to show it
          // Otherwise, default to not_eligible to disable the button
          setRecapStatus("not_eligible");
          return;
        }

        setRecapStatus(statusData.status || "loading");
      } catch (error) {
        console.error("Error checking recap status:", error);
        // On error, default to not_eligible to be safe
        setRecapStatus("not_eligible");
      }
    };

    checkRecapStatus();
  }, [resolvedPuuid, region]);

  // REMOVED: Infinite scroll to prevent excessive API calls
  // REMOVED: Auto-load when screen not full to prevent excessive API calls

  // Force refresh - clears cache and fetches fresh data
  const handleForceRefresh = async () => {
    if (isLoading || !resolvedPuuid) return;
    
    console.log('[Summoner Page] 🔄 Force refresh - clearing cache and fetching fresh data');
    
    // Clear cache
    localStorage.removeItem(CACHE_KEY);
    
    // Reset state
    setMatches([]);
    setCurrentStart(0);
    setHasMoreMatches(true);
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch(`/api/riot/match-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          puuid: resolvedPuuid,
          region,
          start: "0",
          count: COUNT.toString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch match history");
      }

      const { matches: newMatches } = await response.json();
      const validMatches = filterValidMatches(newMatches);
      
      setMatches(validMatches);
      setHasMoreMatches(validMatches.length === COUNT);
      setCurrentStart(validMatches.length);
      
      // Cache fresh data (limit to 20 matches)
      try {
        const matchesToCache = validMatches.slice(0, 20);
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            matches: matchesToCache,
            timestamp: Date.now(),
            start: validMatches.length,
          })
        );
      } catch (cacheError) {
        console.warn('[Summoner Page] Failed to cache refreshed matches (quota exceeded):', cacheError);
        // Clear old caches and current cache if quota exceeded
        cleanupOldCaches();
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      console.log(`[Summoner Page] ✅ Refreshed with ${validMatches.length} matches`);
    } catch (err) {
      console.error("[Summoner Page] ❌ Failed to refresh:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh matches");
    } finally {
      setIsLoading(false);
    }
  };

  // Manual load more - ONLY triggered by button click
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreMatches || !resolvedPuuid) return;

    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadMoreTimeRef.current;

    if (
      lastLoadMoreTimeRef.current !== 0 &&
      timeSinceLastLoad < MIN_LOAD_MORE_DELAY_MS
    ) {
      console.log(`[Summoner Page] ⏳ Throttled: wait ${MIN_LOAD_MORE_DELAY_MS - timeSinceLastLoad}ms`);
      return;
    }

    lastLoadMoreTimeRef.current = now;
    console.log(`[Summoner Page] 📥 Manual load more - fetching from ${currentStart}`);
    setIsLoadingMore(true);

    try {
      const response = await fetch(`/api/riot/match-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          puuid,
          region,
          start: currentStart.toString(),
          count: COUNT.toString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch match history");
      }

      const { matches: newMatches } = await response.json();
      const validMatches = filterValidMatches(newMatches);

      setMatches((prev) => {
        const existingIds = new Set(
          prev.map((m) => m.metadata?.matchId).filter(Boolean)
        );
        const uniqueNewMatches = validMatches.filter(
          (m) => m.metadata?.matchId && !existingIds.has(m.metadata.matchId)
        );
        const updatedMatches = [...prev, ...uniqueNewMatches];
        
        // Update cache with new matches (limit to 20 to avoid quota)
        try {
          const matchesToCache = updatedMatches.slice(0, 20);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              matches: matchesToCache,
              timestamp: Date.now(),
              start: currentStart + uniqueNewMatches.length,
            })
          );
        } catch (cacheError) {
          console.warn('[Summoner Page] Failed to cache more matches (quota exceeded):', cacheError);
          // Clear old caches and current cache if quota exceeded
          cleanupOldCaches();
          try {
            localStorage.removeItem(CACHE_KEY);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        console.log(`[Summoner Page] ✅ Loaded ${uniqueNewMatches.length} more matches (total: ${updatedMatches.length})`);
        return updatedMatches;
      });
      setHasMoreMatches(validMatches.length === COUNT);
      setCurrentStart((prev) => prev + validMatches.length);
    } catch (err) {
      console.error("[Summoner Page] ❌ Failed to load more matches:", err);
      setError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923] flex items-center justify-center">
        <div className="text-white text-xl">Loading match history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923]">
      {/* Combined Header with Profile + Rank */}
      <SummonerHeader
        summonerData={summonerData}
        summonerName={decodedName}
        rankData={rankData}
        featuredChampion={highestMasteryChampionName}
        getProfileIconUrl={getProfileIconUrl}
        getRankEmblemUrl={getRankEmblemUrl}
      />

      {/* Match History */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Main Content: Champion Performance (Left) + Match History (Right) */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Match History*/}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">Match History</h2>
                <button
                  onClick={handleForceRefresh}
                  disabled={isLoading}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                  title="Refresh matches"
                >
                  <svg 
                    className={`w-4 h-4 text-gray-400 group-hover:text-white transition-colors ${isLoading ? 'animate-spin' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                </button>
              </div>
              <button
                onClick={async () => {
                  if (
                    !resolvedPuuid ||
                    isGeneratingRecap ||
                    recapStatus === "not_eligible"
                  )
                    return;

                  if (recapStatus === "available") {
                    // Recap already exists, redirect to view it
                    router.push(`/recap?puuid=${resolvedPuuid}&region=${region}`);
                    return;
                  }

                  if (recapStatus === "processing") {
                    // Already processing - redirect to recap page to see progress
                    router.push(`/recap?puuid=${resolvedPuuid}&region=${region}`);
                    return;
                  }

                  // Eligible - start the job
                  if (recapStatus === "eligible") {
                    setIsGeneratingRecap(true);
                    try {
                      const response = await fetch("/api/riot/recap/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          puuid: resolvedPuuid,
                          region,
                        }),
                      });
                      await response.json();
                      // Redirect to recap page - it will poll for status
                      router.push(`/recap?puuid=${resolvedPuuid}&region=${region}`);
                    } catch (error) {
                      console.error("Failed to generate recap:", error);
                      setIsGeneratingRecap(false);
                    }
                  }
                }}
                disabled={
                  isGeneratingRecap ||
                  !resolvedPuuid ||
                  recapStatus === "not_eligible" ||
                  recapStatus === "loading" ||
                  recapStatus === "processing"
                }
                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  recapStatus === "not_eligible"
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed opacity-50"
                    : recapStatus === "available"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {recapStatus === "loading" ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Loading</span>
                  </>
                ) : recapStatus === "processing" ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Generating...</span>
                  </>
                ) : recapStatus === "not_eligible" ? (
                  "Season Recap (Ineligible)"
                ) : recapStatus === "available" ? (
                  "View Season Recap"
                ) : isGeneratingRecap ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Generating</span>
                  </>
                ) : (
                  "Generate Season Recap"
                )}
              </button>
            </div>

            <div className="space-y-2">
              {matches.map((match) => (
                <MatchCard
                  key={match.metadata.matchId}
                  match={match}
                  puuid={resolvedPuuid!}
                  region={region}
                  getChampionImageUrl={getChampionImageUrl}
                  getItemImageUrl={getItemImageUrl}
                  getQueueType={getQueueType}
                  isRankedQueue={isRankedQueue}
                  isReviewableQueue={isReviewableQueue}
                  formatDuration={formatDuration}
                  formatTimeAgo={formatTimeAgo}
                  reorderItemsWithBootsFirst={reorderItemsWithBootsFirst}
                />
              ))}
            </div>

            {/* Show More Button */}
            {hasMoreMatches && matches.length > 0 && (
              <div className="flex justify-center py-8">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      Show More Matches
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* End of matches indicator */}
            {!hasMoreMatches && matches.length > 0 && (
              <div className="text-center py-8 text-gray-400">
                You&apos;ve reached the end of the match history
              </div>
            )}

            {matches.length === 0 && !isLoading && (
              <div className="text-center text-gray-400 py-12">
                No matches found for this summoner.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
