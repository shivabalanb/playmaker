"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  SummonerHeader,
  MatchCard,
  type MatchData,
  type SummonerData,
  type RankData,
  type ChampionStats,
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
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const puuid = searchParams.get("puuid");
  const region = searchParams.get("region") || "americas";
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [displayedMatchCount, setDisplayedMatchCount] = useState(10);
  const [summonerData, setSummonerData] = useState<SummonerData | null>(null);
  const [rankData, setRankData] = useState<RankData | null>(null);
  const [championStats, setChampionStats] = useState<
    Map<string, ChampionStats>
  >(new Map());
  const [highestMasteryChampionName, setHighestMasteryChampionName] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // Decode summoner name
  const decodedName = decodeURIComponent(resolvedParams.name).replace("-", "#");

  useEffect(() => {
    console.log("PUUID from URL:", puuid);
    console.log("Region from URL:", region);

    if (!puuid) {
      setError("No PUUID provided");
      setIsLoading(false);
      return;
    }

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

    // Helper function to fetch with retry logic based on Riot API rate limits
    const fetchWithRetry = async (
      url: string,
      retries = 3,
      delay = 1000
    ): Promise<{
      error: boolean;
      status?: number;
      message?: string;
      data?: MatchData;
    }> => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url);

          // If rate limited (429), check for Retry-After header and wait
          if (res.status === 429 && i < retries - 1) {
            // Riot API returns Retry-After header in seconds
            const retryAfter = res.headers.get("Retry-After");
            const waitTime = retryAfter
              ? parseInt(retryAfter) * 1000 // Convert seconds to milliseconds
              : delay * Math.pow(2, i); // Fallback to exponential backoff

            console.warn(
              `Rate limited (429). ${retryAfter ? `API says wait ${retryAfter}s` : `Using exponential backoff ${waitTime}ms`}. Retrying... (attempt ${i + 1}/${retries})`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }

          // If we get rate limit info in headers, log it for debugging
          const rateLimitCount = res.headers.get("X-Rate-Limit-Count");
          const rateLimitType = res.headers.get("X-Rate-Limit-Type");
          if (rateLimitCount && i === 0) {
            console.debug(
              `Rate limit usage: ${rateLimitCount} (type: ${rateLimitType || "unknown"})`
            );
          }

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            return {
              error: true,
              status: res.status,
              message: errorData.error || "Unknown error",
            };
          }

          return { error: false, data: await res.json() };
        } catch (error) {
          if (i === retries - 1) {
            return {
              error: true,
              status: 0,
              message: error instanceof Error ? error.message : "Unknown error",
            };
          }
          // For network errors, use exponential backoff
          const waitTime = delay * Math.pow(2, i);
          console.warn(
            `Network error, retrying in ${waitTime}ms... (attempt ${i + 1}/${retries})`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
      return { error: true, status: 0, message: "Max retries exceeded" };
    };

    const fetchMatchHistory = async () => {
      try {
        // Fetch ALL available match IDs (Riot API max is 100 per request)
        const matchIdsResponse = await fetch(
          `/api/riot/matches?puuid=${puuid}&region=${region}`
        );

        if (!matchIdsResponse.ok) {
          throw new Error("Failed to fetch match history");
        }

        const { matchIds: ids } = await matchIdsResponse.json();
        console.log(`Fetching ${ids.length} matches...`);

        // PROGRESSIVE LOADING: Fetch first 20 matches quickly, then load more in background
        const INITIAL_BATCH_SIZE = 20;
        const allMatches: MatchData[] = [];

        // Helper to update state with current matches
        const updateMatchState = (matches: MatchData[]) => {
          setMatches([...matches]);

          // Recalculate champion stats from ranked matches
          const rankedMatches = matches.filter((match) =>
            isRankedQueue(match.info.queueId)
          );

          const champStats = new Map<
            string,
            {
              games: number;
              wins: number;
              kills: number;
              deaths: number;
              assists: number;
            }
          >();

          rankedMatches.forEach((match) => {
            const playerData = match.info.participants.find(
              (p) => p.puuid === puuid
            );
            if (playerData) {
              const champion = playerData.championName;
              const existing = champStats.get(champion) || {
                games: 0,
                wins: 0,
                kills: 0,
                deaths: 0,
                assists: 0,
              };

              champStats.set(champion, {
                games: existing.games + 1,
                wins: existing.wins + (playerData.win ? 1 : 0),
                kills: existing.kills + playerData.kills,
                deaths: existing.deaths + playerData.deaths,
                assists: existing.assists + playerData.assists,
              });
            }
          });

          setChampionStats(champStats);
        };

        // Fetch matches in batches
        for (
          let batchStart = 0;
          batchStart < ids.length;
          batchStart += INITIAL_BATCH_SIZE
        ) {
          const batchEnd = Math.min(
            batchStart + INITIAL_BATCH_SIZE,
            ids.length
          );
          const batchIds = ids.slice(batchStart, batchEnd);

          console.log(
            `Fetching batch ${Math.floor(batchStart / INITIAL_BATCH_SIZE) + 1}: matches ${batchStart + 1}-${batchEnd}`
          );

          // Fetch this batch with staggered requests
          const batchPromises = batchIds.map(
            async (matchId: string, index: number) => {
              // Stagger within batch to avoid rate limits
              await new Promise((resolve) => setTimeout(resolve, index * 100));

              const result = await fetchWithRetry(
                `/api/riot/match?matchId=${matchId}&region=${region}`
              );

              if (result.error) {
                console.warn(
                  `Skipping match ${matchId}: ${result.status} ${result.message}`
                );
                return null;
              }

              return result.data;
            }
          );

          // Wait for this batch to complete
          const batchResults = await Promise.all(batchPromises);

          // Filter and add valid matches to our collection
          // Exclude Swarm matches and invalid matches
          const validBatchMatches = batchResults.filter(
            (match): match is MatchData =>
              match !== null &&
              match.info !== undefined &&
              match.info.participants !== undefined &&
              Array.isArray(match.info.participants) &&
              !isSwarmQueue(match.info.queueId)
          );

          allMatches.push(...validBatchMatches);

          // Update UI after each batch (shows matches progressively!)
          updateMatchState(allMatches);

          // After first batch, hide main loading screen
          if (batchStart === 0) {
            setIsLoading(false);
            console.log(
              `✅ First ${validBatchMatches.length} matches loaded! Continuing in background...`
            );
          }
        }

        // Final summary
        const rankedCount = allMatches.filter((m) =>
          isRankedQueue(m.info.queueId)
        ).length;
        console.log(`=== LOADING COMPLETE ===`);
        console.log(
          `Total matches: ${allMatches.length} (${rankedCount} ranked)`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load matches");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummonerData();
    fetchMatchHistory();
  }, [puuid, region]);

  // Set mounted state for client-side only rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (isLoadingMore) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;

      // Load more when user is 500px from bottom
      if (
        scrollPosition >= pageHeight - 500 &&
        displayedMatchCount < matches.length
      ) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setDisplayedMatchCount((prev) => Math.min(prev + 10, matches.length));
          setIsLoadingMore(false);
        }, 300);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [displayedMatchCount, matches.length, isLoadingMore]);

  // Get featured champion for splash art background
  // Priority: 1) Highest Mastery, 2) Most Played (recent matches), 3) Last Match
  const getFeaturedChampion = (): string | null => {
    // Priority 1: Highest Mastery Champion (best indicator of favorite)
    if (highestMasteryChampionName) {
      console.log("Using highest mastery champion:", highestMasteryChampionName);
      return highestMasteryChampionName;
    }

    // Priority 2: Most Played Champion (from recent ranked matches)
    if (championStats.size > 0) {
      const sorted = Array.from(championStats.entries()).sort(
        (a, b) => b[1].games - a[1].games
      );
      const mostPlayed = sorted[0]?.[0] || null;
      if (mostPlayed) {
        console.log("Using most played champion:", mostPlayed);
        return mostPlayed;
      }
    }

    // Priority 3: Last Match Champion
    if (matches.length > 0) {
      const playerData = matches[0].info.participants.find(
        (p) => p.puuid === puuid
      );
      const lastMatchChampion = playerData?.championName || null;
      if (lastMatchChampion) {
        console.log("Using last match champion:", lastMatchChampion);
        return lastMatchChampion;
      }
    }

    console.log("No featured champion found");
    return null;
  };

  const featuredChampion = getFeaturedChampion();

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
        featuredChampion={featuredChampion}
        getProfileIconUrl={getProfileIconUrl}
        getRankEmblemUrl={getRankEmblemUrl}
      />

      {/* Match History */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Main Content: Champion Performance (Left) + Match History (Right) */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Champion Performance - Left Sidebar */}
          {/* <ChampionPerformance
            championStats={championStats}
            getChampionImageUrl={getChampionImageUrl}
          /> */}

          {/* Match History - Right Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Match History</h2>
            </div>

            <div className="space-y-2">
              {matches.slice(0, displayedMatchCount).map((match) => (
                <MatchCard
                  key={match.metadata.matchId}
                  match={match}
                  puuid={puuid!}
                  isMounted={isMounted}
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

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}

            {/* Load more button (fallback if scroll doesn't trigger) */}
            {displayedMatchCount < matches.length && !isLoadingMore && (
              <div className="flex justify-center py-8">
                <button
                  onClick={() =>
                    setDisplayedMatchCount((prev) =>
                      Math.min(prev + 10, matches.length)
                    )
                  }
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Load More Matches ({matches.length - displayedMatchCount}{" "}
                  remaining)
                </button>
              </div>
            )}

            {/* End of matches indicator */}
            {displayedMatchCount >= matches.length && matches.length > 0 && (
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
