"use client";

import { useEffect, useState, use, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
  isSwarmQueue,
  getPlatformRegion,
  reorderItemsWithBootsFirst,
  formatDuration,
  formatTimeAgo,
  getChampionNameById,
} from "@/lib";

export default function SummonerPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const COUNT = 10;
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const puuid = searchParams.get("puuid");
  const region = searchParams.get("region") || "americas";
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
  const lastLoadMoreTimeRef = useRef<number>(0);
  const MIN_LOAD_MORE_DELAY_MS = 1000; // Minimum 1 second between load more calls
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

    if (!puuid) {
      setError("No PUUID provided");
      setIsLoading(false);
      return;
    }

    // Reset pagination state when summoner changes
    setMatches([]);
    setCurrentStart(0);
    setHasMoreMatches(true);
    setIsLoading(true);
    // Note: lastLoadMoreTimeRef will reset automatically on component unmount
    // For navigation between summoners, we reset it here to allow immediate loading
    lastLoadMoreTimeRef.current = 0;

    const fetchSummonerData = async () => {
      try {
        const platform = getPlatformRegion(region);

        // Fetch summoner data (profile icon, level)
        const response = await fetch(
          `/api/riot/summoner?puuid=${puuid}&platform=${platform}`
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
          `/api/riot/league?puuid=${puuid}&platform=${platform}`
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
          `/api/riot/mastery?puuid=${puuid}&platform=${platform}`
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
      if (!puuid) return;

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
            puuid,
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
          setMatches((prev) => [...prev, ...validMatches]);
        } else {
          setMatches(validMatches);
        }

        setHasMoreMatches(validMatches.length === COUNT);
        setCurrentStart(start + validMatches.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load matches");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    fetchSummonerData();
    fetchMatchHistory(0, false);

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

    fetchPlayerAnalysis();
  }, [puuid, region]);

  // Infinite scroll handler using Intersection Observer
  useEffect(() => {
    if (!hasMoreMatches || isLoadingMore || !puuid || matches.length === 0)
      return;

    const loadMoreMatches = async () => {
      // Lock: prevent multiple simultaneous requests
      if (isLoadingMore || !hasMoreMatches) return;

      // Throttle: prevent load more from being called too frequently
      const now = Date.now();
      const timeSinceLastLoad = now - lastLoadMoreTimeRef.current;

      // If ref is 0 (initial state) or enough time has passed, allow the request
      if (
        lastLoadMoreTimeRef.current !== 0 &&
        timeSinceLastLoad < MIN_LOAD_MORE_DELAY_MS
      ) {
        const remainingDelay = MIN_LOAD_MORE_DELAY_MS - timeSinceLastLoad;
        console.log(
          `[Infinite Scroll] Throttled: waiting ${remainingDelay}ms before next load`
        );
        return;
      }

      lastLoadMoreTimeRef.current = now;
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

        setMatches((prev) => [...prev, ...validMatches]);
        setHasMoreMatches(validMatches.length === COUNT);
        setCurrentStart((prev) => prev + validMatches.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load matches");
      } finally {
        setIsLoadingMore(false);
      }
    };

    // Use Intersection Observer for better reliability
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMoreMatches();
        }
      },
      {
        root: null,
        rootMargin: "200px", // Start loading 200px before the sentinel is visible
        threshold: 0.1,
      }
    );

    // Find the sentinel element (the loading indicator or end message)
    const sentinel = document.getElementById("infinite-scroll-sentinel");
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [
    currentStart,
    isLoadingMore,
    hasMoreMatches,
    puuid,
    region,
    matches.length,
  ]);

  // Check if we need to load more when all matches fit on screen (no scrollbar)
  useEffect(() => {
    if (
      !hasMoreMatches ||
      isLoadingMore ||
      !puuid ||
      matches.length === 0 ||
      isLoading
    )
      return;

    const checkAndLoad = () => {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        // Check if page is scrollable
        const isScrollable =
          document.documentElement.scrollHeight > window.innerHeight;

        // If not scrollable and we have more matches, load more automatically
        if (!isScrollable && hasMoreMatches && !isLoadingMore) {
          setIsLoadingMore(true);

          fetch(`/api/riot/match-history`, {
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
          })
            .then((response) => {
              if (response.ok) {
                return response.json();
              }
              throw new Error("Failed to fetch match history");
            })
            .then((data) => {
              const validMatches = filterValidMatches(data.matches);

              setMatches((prev) => {
                const existingIds = new Set(
                  prev.map((m) => m.metadata?.matchId).filter(Boolean)
                );
                const uniqueNewMatches = validMatches.filter(
                  (m) =>
                    m.metadata?.matchId && !existingIds.has(m.metadata.matchId)
                );
                return [...prev, ...uniqueNewMatches];
              });
              setHasMoreMatches(validMatches.length === COUNT);
              setCurrentStart((prev) => prev + validMatches.length);
            })
            .catch((err) => {
              console.error("Failed to load more matches:", err);
            })
            .finally(() => {
              setIsLoadingMore(false);
            });
        }
      }, 300);
    };

    checkAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length]); // Only run when matches change to check if we need to load more

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
              <h2 className="text-xl font-bold text-white">Match History</h2>
            </div>

            <div className="space-y-2">
              {matches.map((match) => (
                <MatchCard
                  key={match.metadata.matchId}
                  match={match}
                  puuid={puuid!}
                  region={region}
                  getChampionImageUrl={getChampionImageUrl}
                  getItemImageUrl={getItemImageUrl}
                  getQueueType={getQueueType}
                  isRankedQueue={isRankedQueue}
                  formatDuration={formatDuration}
                  formatTimeAgo={formatTimeAgo}
                  reorderItemsWithBootsFirst={reorderItemsWithBootsFirst}
                />
              ))}
            </div>

            {/* Sentinel element for Intersection Observer */}
            <div id="infinite-scroll-sentinel" className="h-1" />

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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