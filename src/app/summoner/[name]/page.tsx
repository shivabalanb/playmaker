"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface MatchData {
  metadata: {
    matchId: string;
  };
  info: {
    queueId: number;
    gameDuration: number;
    gameCreation: number;
    participants: Array<{
      puuid: string;
      championName: string;
      kills: number;
      deaths: number;
      assists: number;
      win: boolean;
      goldEarned: number;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
      item0: number;
      item1: number;
      item2: number;
      item3: number;
      item4: number;
      item5: number;
      item6: number;
      summoner1Id: number;
      summoner2Id: number;
      perks: {
        styles: Array<{
          selections: Array<{
            perk: number;
          }>;
        }>;
      };
    }>;
  };
}

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
  const [summonerData, setSummonerData] = useState<{
    profileIconId: number;
    summonerLevel: number;
    id: string;
  } | null>(null);
  const [rankData, setRankData] = useState<{
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
  } | null>(null);
  const [championStats, setChampionStats] = useState<
    Map<
      string,
      {
        games: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
      }
    >
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Data Dragon version (update periodically)
  const DD_VERSION = "15.22.1";

  // Queue ID to game type mapping
  const getQueueType = (queueId: number): string => {
    const queueTypes: { [key: number]: string } = {
      420: "Ranked Solo/Duo",
      440: "Ranked Flex",
      400: "Normal Draft",
      430: "Normal Blind",
      450: "ARAM",
      1700: "Arena",
      700: "Clash",
      490: "Quickplay",
      830: "Intro Bots",
      840: "Beginner Bots",
      850: "Intermediate Bots",
      900: "ARURF",
    };
    return queueTypes[queueId] || `Queue ${queueId}`;
  };

  // Check if queue is ranked
  const isRankedQueue = (queueId: number): boolean => {
    return queueId === 420 || queueId === 440;
  };

  // Map routing region to platform region
  const getPlatformRegion = (routingRegion: string): string => {
    const platformMap: Record<string, string> = {
      americas: "na1",
      europe: "euw1",
      asia: "kr",
      sea: "sg2",
    };
    return platformMap[routingRegion] || "na1";
  };

  // Decode summoner name
  const decodedName = decodeURIComponent(resolvedParams.name).replace("-", "#");

  // Helper function to get champion image URL
  const getChampionImageUrl = (championName: string): string => {
    return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion/${championName}.png`;
  };

  // Helper function to get item image URL
  const getItemImageUrl = (itemId: number): string => {
    return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/item/${itemId}.png`;
  };

  // Helper function to get profile icon URL
  const getProfileIconUrl = (iconId: number): string => {
    return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/profileicon/${iconId}.png`;
  };

  // Helper function to check if an item is boots
  const isBoots = (itemId: number): boolean => {
    const bootsIds = [
      // Base Boots
      1001, // Boots
      2422, // Slightly Magical Footwear

      // Tier 2 Boots
      3006, // Berserker's Greaves
      3009, // Boots of Swiftness
      3010, // Symbiotic Soles
      3020, // Sorcerer's Shoes
      3047, // Plated Steelcaps
      3111, // Mercury's Treads
      3158, // Ionian Boots of Lucidity

      // Tier 3 Boots
      3170, // Swiftmarch (from Boots of Swiftness)
      3171, // Crimson Lucidity (from Ionian Boots of Lucidity)
      3172, // Gunmetal Greaves (from Berserker's Greaves)
      3173, // Chainlaced Crushers (from Mercury's Treads)
      3174, // Armored Advance (from Plated Steelcaps)
      3175, // Spellslinger's Shoes (from Sorcerer's Shoes)
      3176, // Synchronized Souls (from Symbiotic Soles)
    ];
    return bootsIds.includes(itemId);
  };

  // Helper function to reorder items with boots first
  const reorderItemsWithBootsFirst = (items: number[]): number[] => {
    const bootsIndex = items.findIndex((item) => item > 0 && isBoots(item));
    if (bootsIndex === -1 || bootsIndex === 0) {
      // No boots or boots already first
      return items;
    }
    // Move boots to first position
    const reordered = [...items];
    const boots = reordered[bootsIndex];
    reordered.splice(bootsIndex, 1);
    reordered.unshift(boots);
    return reordered;
  };

  useEffect(() => {
    if (!puuid) {
      setError("No PUUID provided");
      setIsLoading(false);
      return;
    }

    const fetchSummonerData = async () => {
      try {
        const platform = getPlatformRegion(region);
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

          // Fetch rank data
          const rankResponse = await fetch(
            `/api/riot/league?summonerId=${data.id}&platform=${platform}`
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
        }
      } catch (err) {
        console.error("Failed to fetch summoner data:", err);
      }
    };

    const fetchMatchHistory = async () => {
      try {
        // Fetch match IDs - get more matches for champion stats
        const matchIdsResponse = await fetch(
          `/api/riot/matches?puuid=${puuid}&region=${region}&count=50`
        );

        if (!matchIdsResponse.ok) {
          throw new Error("Failed to fetch match history");
        }

        const { matchIds: ids } = await matchIdsResponse.json();

        // Fetch detailed match data for each match
        const matchPromises = ids.map(async (matchId: string) => {
          try {
            const res = await fetch(
              `/api/riot/match?matchId=${matchId}&region=${region}`
            );
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              console.warn(
                `Skipping match ${matchId}: ${res.status} ${errorData.error || "Unknown error"}`
              );
              return null;
            }
            return await res.json();
          } catch (error) {
            console.warn(`Skipping match ${matchId}:`, error);
            return null;
          }
        });

        const matchesData = await Promise.all(matchPromises);

        // Filter out null/invalid matches and validate structure
        const validMatches = matchesData.filter(
          (match): match is MatchData =>
            match !== null &&
            match.info !== undefined &&
            match.info.participants !== undefined &&
            Array.isArray(match.info.participants)
        );

        console.log("=== MATCH DATA ===");
        console.log(`Total matches fetched: ${validMatches.length}`);
        validMatches.forEach((match, index) => {
          console.log(`\n--- Match ${index + 1} ---`);
          console.log("Match ID:", match.metadata.matchId);
          console.log("Queue ID:", match.info.queueId);
          console.log("Queue Type:", getQueueType(match.info.queueId));
          console.log("Is Ranked:", isRankedQueue(match.info.queueId));
          console.log("Game Duration:", match.info.gameDuration);
          console.log(
            "Game Creation:",
            new Date(match.info.gameCreation).toLocaleString()
          );

          const playerData = match.info.participants.find(
            (p) => p.puuid === puuid
          );
          if (playerData) {
            console.log("Player Champion:", playerData.championName);
            console.log("Player Result:", playerData.win ? "WIN" : "LOSS");
            console.log(
              "Player KDA:",
              `${playerData.kills}/${playerData.deaths}/${playerData.assists}`
            );
          }
        });
        console.log("\n===================\n");

        setMatches(validMatches);

        // Calculate champion statistics - ONLY from ranked games (420, 440)
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

        const rankedMatches = validMatches.filter((match) =>
          isRankedQueue(match.info.queueId)
        );

        console.log(
          `Calculating champion stats from ${rankedMatches.length} ranked games out of ${validMatches.length} total games`
        );

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load matches");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummonerData();
    fetchMatchHistory();
  }, [puuid, region]);

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  const getPlayerData = (match: MatchData) => {
    if (!match?.info?.participants) {
      return null;
    }
    return match.info.participants.find((p) => p.puuid === puuid);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923] flex items-center justify-center">
        <div className="text-white text-xl">Loading match history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923] flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923]">
      {/* Header */}
      <header className="pt-8 pb-6 border-b border-[#2a3a4a]">
        <div className="container mx-auto px-4">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 mb-4 inline-block"
          >
            ← Back to Search
          </Link>
          <div className="flex items-center gap-6">
            {summonerData && (
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#3a4a5a] shadow-xl">
                  <Image
                    src={getProfileIconUrl(summonerData.profileIconId)}
                    alt="Profile Icon"
                    width={96}
                    height={96}
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black rounded-xl w-10 h-7 flex items-center justify-center border-3 border-[#0f1923] shadow-lg">
                  <span className="text-xs font-bold text-white">
                    {summonerData.summonerLevel}
                  </span>
                </div>
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold text-white">{decodedName}</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Match History */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Rank Stats - Top */}
        {rankData && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ranked Solo */}
            <div className="bg-[#1e2a3a] rounded-xl p-6 border border-[#2a3a4a]">
              <h3 className="text-lg font-semibold text-gray-300 mb-4">
                Ranked Solo
              </h3>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {rankData.tier} {rankData.rank}
                  </div>
                  <div className="text-sm text-gray-400">
                    {rankData.leaguePoints} LP
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-white">
                    {rankData.wins}W - {rankData.losses}L
                  </div>
                  <div className="text-lg text-gray-400">
                    {(
                      (rankData.wins / (rankData.wins + rankData.losses)) *
                      100
                    ).toFixed(0)}
                    % Winrate
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Stats */}
            <div className="bg-[#1e2a3a] rounded-xl p-6 border border-[#2a3a4a]">
              <h3 className="text-lg font-semibold text-gray-300 mb-4">
                Last {matches.length} Games
              </h3>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">2.5</div>
                  <div className="text-sm text-gray-400">KDA</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {
                      matches.filter((m) => {
                        const p = m.info.participants.find(
                          (p) => p.puuid === puuid
                        );
                        return p?.win;
                      }).length
                    }
                    W-
                    {
                      matches.filter((m) => {
                        const p = m.info.participants.find(
                          (p) => p.puuid === puuid
                        );
                        return !p?.win;
                      }).length
                    }
                    L
                  </div>
                  <div className="text-sm text-gray-400">
                    {(
                      (matches.filter((m) => {
                        const p = m.info.participants.find(
                          (p) => p.puuid === puuid
                        );
                        return p?.win;
                      }).length /
                        matches.length) *
                      100
                    ).toFixed(0)}
                    % WR
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content: Champion Performance (Left) + Match History (Right) */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Champion Performance - Left Sidebar */}
          {championStats.size > 0 && (
            <aside className="lg:w-80 flex-shrink-0">
              <div className="bg-[#1e2a3a] rounded-xl p-5 border border-[#2a3a4a] sticky top-4">
                <h3 className="text-lg font-bold text-white mb-4">
                  Champion Performance
                </h3>
                <div className="space-y-2">
                  {Array.from(championStats.entries())
                    .sort((a, b) => b[1].games - a[1].games)
                    .slice(0, 5)
                    .map(([champion, stats]) => {
                      const kda =
                        stats.deaths > 0
                          ? (
                              (stats.kills + stats.assists) /
                              stats.deaths
                            ).toFixed(1)
                          : "Perfect";
                      const winrate = (
                        (stats.wins / stats.games) *
                        100
                      ).toFixed(0);

                      return (
                        <div
                          key={champion}
                          className="flex items-center justify-between p-3 bg-[#2a3544] rounded-lg hover:bg-[#354252] transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-[#3a4a5a] flex-shrink-0">
                              <Image
                                src={getChampionImageUrl(champion)}
                                alt={champion}
                                width={40}
                                height={40}
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-white truncate">
                                {champion}
                              </div>
                              <div className="text-xs text-gray-400">
                                {(stats.kills / stats.games).toFixed(1)} /{" "}
                                {(stats.deaths / stats.games).toFixed(1)} /{" "}
                                {(stats.assists / stats.games).toFixed(1)}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-3">
                            <div
                              className={`text-base font-bold ${
                                parseInt(winrate) >= 50
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {winrate}%
                            </div>
                            <div className="text-xs text-gray-400 whitespace-nowrap">
                              {kda} KDA
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </aside>
          )}

          {/* Match History - Right Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Match History</h2>
              <div className="text-xs text-gray-400">
                Showing {displayedMatchCount} of {matches.length} matches
              </div>
            </div>

            <div className="space-y-2">
              {matches.slice(0, displayedMatchCount).map((match) => {
                const playerData = getPlayerData(match);
                if (!playerData) return null;

                const isVictory = playerData.win;
                const kda = `${playerData.kills}/${playerData.deaths}/${playerData.assists}`;
                const cs =
                  playerData.totalMinionsKilled +
                  playerData.neutralMinionsKilled;

                // Separate regular items (0-5) from trinket (6)
                const rawItems = [
                  playerData.item0,
                  playerData.item1,
                  playerData.item2,
                  playerData.item3,
                  playerData.item4,
                  playerData.item5,
                ];
                // Sort items by item ID in descending order (reverse)
                const sortedItems = [...rawItems].sort((a, b) => b - a);
                // Reorder to put boots first if they exist
                const regularItems = reorderItemsWithBootsFirst(sortedItems);
                const trinketItem = playerData.item6;

                return (
                  <div
                    key={match.metadata.matchId}
                    className={`bg-[#1e2a3a] border-l-4 ${
                      isVictory ? "border-green-500" : "border-red-500"
                    } rounded-lg p-4 hover:bg-[#22303f] transition-colors`}
                  >
                    <div className="flex items-center gap-6">
                      {/* Champion and Result */}
                      <div className="flex items-center gap-4 min-w-[280px]">
                        {/* Champion Icon */}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-[#3a4a5a] shrink-0">
                          <Image
                            src={getChampionImageUrl(playerData.championName)}
                            alt={playerData.championName}
                            width={48}
                            height={48}
                            className="object-cover"
                            unoptimized
                          />
                        </div>

                        <div className="flex flex-col gap-0.5 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-base font-semibold text-white">
                              {playerData.championName}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                                isVictory
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {isVictory ? "VICTORY" : "DEFEAT"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span
                              className={
                                isRankedQueue(match.info.queueId)
                                  ? "text-gray-300"
                                  : "text-gray-500"
                              }
                            >
                              {getQueueType(match.info.queueId)}
                            </span>
                            <span>•</span>
                            <span>
                              {formatDuration(match.info.gameDuration)}
                            </span>
                            <span>•</span>
                            <span>
                              {formatTimeAgo(match.info.gameCreation)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* KDA */}
                      <div className="flex flex-col items-center min-w-[90px]">
                        <div className="text-lg font-bold text-white">
                          {kda}
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap">
                          {playerData.deaths > 0
                            ? (
                                (playerData.kills + playerData.assists) /
                                playerData.deaths
                              ).toFixed(2)
                            : "Perfect"}{" "}
                          KDA
                        </div>
                      </div>

                      {/* Items */}
                      <div className="flex items-start gap-1.5 min-w-[110px]">
                        {/* Regular Items (6 slots) */}
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            {regularItems.slice(0, 3).map((item, idx) =>
                              item > 0 ? (
                                <div
                                  key={idx}
                                  className="relative w-8 h-8 bg-[#0a0e14] rounded border border-[#3a4a5a] overflow-hidden"
                                >
                                  <Image
                                    src={getItemImageUrl(item)}
                                    alt={`Item ${item}`}
                                    width={32}
                                    height={32}
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div
                                  key={idx}
                                  className="w-8 h-8 bg-[#0a0e14] rounded border border-[#2a3a4a]"
                                />
                              )
                            )}
                          </div>
                          <div className="flex gap-1">
                            {regularItems.slice(3, 6).map((item, idx) =>
                              item > 0 ? (
                                <div
                                  key={idx + 3}
                                  className="relative w-8 h-8 bg-[#0a0e14] rounded border border-[#3a4a5a] overflow-hidden"
                                >
                                  <Image
                                    src={getItemImageUrl(item)}
                                    alt={`Item ${item}`}
                                    width={32}
                                    height={32}
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div
                                  key={idx + 3}
                                  className="w-8 h-8 bg-[#0a0e14] rounded border border-[#2a3a4a]"
                                />
                              )
                            )}
                          </div>
                        </div>

                        {/* Trinket Item (far right) */}
                        <div className="flex flex-col gap-1">
                          {trinketItem > 0 ? (
                            <div className="relative w-8 h-8 bg-[#0a0e14] rounded border border-[#3a4a5a] overflow-hidden">
                              <Image
                                src={getItemImageUrl(trinketItem)}
                                alt={`Trinket ${trinketItem}`}
                                width={32}
                                height={32}
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-[#0a0e14] rounded border border-[#2a3a4a]" />
                          )}
                        </div>
                      </div>

                      {/* CS */}
                      <div className="flex flex-col items-center min-w-[80px]">
                        <div className="text-base font-semibold text-white">
                          {cs} CS
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap">
                          {((cs / match.info.gameDuration) * 60).toFixed(1)}{" "}
                          CS/min
                        </div>
                      </div>

                      {/* Review Button */}
                      <button className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors shrink-0">
                        Review
                      </button>
                    </div>
                  </div>
                );
              })}
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
