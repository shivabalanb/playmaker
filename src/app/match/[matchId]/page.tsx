"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MatchData } from "@/app/components/summoner/types";
import {
  getChampionImageUrl,
  getItemImageUrl,
  getSummonerSpellImageUrl,
  getRuneImageUrl,
  getRoleIconUrl,
  getQueueType,
  formatDuration,
  DD_VERSION,
  reorderItemsWithBootsFirst,
} from "@/lib";
import { calculatePlayerRank } from "@/lib/utils/performanceScore";
import { PerformanceScore } from "@/app/components/summoner/PerformanceScore";

// Cache for summoner spells and runes
let summonerSpellCache: Map<number, { image: { full: string } }> | null = null;
let runeCache: Map<number, { icon: string }> | null = null;
let runeStyleCache: Map<number, { icon: string }> | null = null;

export default function MatchDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const region = searchParams.get("region") || "americas";
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentFrame, setCurrentFrame] = useState(0);

  // Fetch summoner spells and runes data
  useEffect(() => {
    // Fetch summoner spells
    if (!summonerSpellCache) {
      fetch(
        `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/data/en_US/summoner.json`
      )
        .then((res) => res.json())
        .then((data) => {
          const map = new Map<number, { image: { full: string } }>();
          for (const [spellKey, spellData] of Object.entries(data.data)) {
            const spellId = parseInt((spellData as { key: string }).key);
            map.set(spellId, spellData as { image: { full: string } });
          }
          summonerSpellCache = map;
        })
        .catch((err) => console.error("Failed to fetch summoner spells:", err));
    }

    // Fetch runes
    if (!runeCache || !runeStyleCache) {
      fetch(
        `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/data/en_US/runesReforged.json`
      )
        .then((res) => res.json())
        .then((data) => {
          const runeMap = new Map<number, { icon: string }>();
          const styleMap = new Map<number, { icon: string }>();
          for (const style of data) {
            styleMap.set(style.id, { icon: style.icon });
            if (style.slots) {
              for (const slot of style.slots) {
                for (const rune of slot.runes) {
                  runeMap.set(rune.id, { icon: rune.icon });
                }
              }
            }
          }
          runeCache = runeMap;
          runeStyleCache = styleMap;
        })
        .catch((err) => console.error("Failed to fetch runes:", err));
    }
  }, []);

  // Fetch match data and timeline
  useEffect(() => {
    if (!matchId) {
      setError("No match ID provided");
      setIsLoading(false);
      return;
    }

    // Fetch match data
    fetch(`/api/riot/match?matchId=${matchId}&region=${region}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setIsLoading(false);
          return;
        }
        setMatchData(data);

        // Fetch timeline data
        return fetch(
          `/api/riot/match/timeline?matchId=${matchId}&region=${region}`
        );
      })
      .then((res) => {
        if (!res) return;
        return res.json();
      })
      .then((timeline) => {
        if (timeline && !timeline.error) {
          setTimelineData(timeline);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error loading match data:", err);
        setError("Failed to load match data");
        setIsLoading(false);
      });
  }, [matchId, region]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923] flex items-center justify-center">
        <div className="text-white text-xl">Loading match details...</div>
      </div>
    );
  }

  if (error || !matchData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">
            {error || "Match not found"}
          </div>
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

  // Separate teams
  const team100 = matchData.info.participants.filter((p) => p.teamId === 100);
  const team200 = matchData.info.participants.filter((p) => p.teamId === 200);

  // Calculate scores for all players
  const allPlayerScores = matchData.info.participants.map((p) => {
    const team = p.teamId === 100 ? team100 : team200;
    const scoreData = calculatePlayerRank(
      p.puuid,
      matchData.info.participants,
      matchData.info.gameDuration
    );
    return {
      ...p,
      score: scoreData.score,
      rank: scoreData.rank,
    };
  });

  // Sort by rank
  allPlayerScores.sort((a, b) => a.rank - b.rank);

  // Role order for sorting: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
  const roleOrder: { [key: string]: number } = {
    TOP: 1,
    JUNGLE: 2,
    MIDDLE: 3,
    BOTTOM: 4,
    UTILITY: 5,
  };

  // Sort players by role within each team
  const sortPlayersByRole = (players: any[]) => {
    return [...players].sort((a, b) => {
      const roleA = a.teamPosition || "";
      const roleB = b.teamPosition || "";
      return (roleOrder[roleA] || 99) - (roleOrder[roleB] || 99);
    });
  };

  // Determine winning team
  const team100Won = team100[0]?.win || false;
  const team200Won = team200[0]?.win || false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923]">
      {/* Header */}
      <div className="p-2">
        <div className="container mx-auto max-w-7xl flex items-center">
          <Link
            href="/"
            className="text-gray-400 opacity-50 hover:opacity-70 transition-opacity"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>

      {/* Match Detail Content */}
      <div className="container mx-auto max-w-7xl px-2 py-2">
        {/* Team 100 (Blue Side) */}
        <div className="mb-2">
          <div className="flex items-center mb-1">
            <div className="flex items-center gap-1.5">
              <div
                className={`text-sm font-bold ${
                  team100Won ? "text-green-400" : "text-red-400"
                }`}
              >
                {team100Won ? "Victory (Blue Side)" : "Defeat (Blue Side)"}
              </div>
              <span className="text-xs text-gray-400">
                {getQueueType(matchData.info.queueId)}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-400">
                {formatDuration(matchData.info.gameDuration)}
              </span>
            </div>
          </div>
          <div className="space-y-0.5">
            {sortPlayersByRole(
              allPlayerScores.filter((p) => p.teamId === 100)
            ).map((player) => (
              <PlayerRow
                key={player.puuid}
                player={player}
                matchData={matchData}
                summonerSpellCache={summonerSpellCache}
                runeCache={runeCache}
                runeStyleCache={runeStyleCache}
              />
            ))}
          </div>
        </div>

        {/* Team 200 (Red Side) */}
        <div>
          <div className="flex items-center mb-1">
            <div className="flex items-center gap-1.5">
              <div
                className={`text-sm font-bold ${
                  team200Won ? "text-green-400" : "text-red-400"
                }`}
              >
                {team200Won ? "Victory (Red Side)" : "Defeat (Red Side)"}
              </div>
              <span className="text-xs text-gray-400">
                {getQueueType(matchData.info.queueId)}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-400">
                {formatDuration(matchData.info.gameDuration)}
              </span>
            </div>
          </div>
          <div className="space-y-0.5">
            {sortPlayersByRole(
              allPlayerScores.filter((p) => p.teamId === 200)
            ).map((player) => (
              <PlayerRow
                key={player.puuid}
                player={player}
                matchData={matchData}
                summonerSpellCache={summonerSpellCache}
                runeCache={runeCache}
                runeStyleCache={runeStyleCache}
              />
            ))}
          </div>
        </div>

        {/* Map Timeline */}
        {timelineData && matchData && (
          <MapTimeline
            timelineData={timelineData}
            matchData={matchData}
            currentFrame={currentFrame}
            setCurrentFrame={setCurrentFrame}
          />
        )}
      </div>
    </div>
  );
}

interface MapTimelineProps {
  timelineData: any;
  matchData: MatchData;
  currentFrame: number;
  setCurrentFrame: (frame: number) => void;
}

function MapTimeline({
  timelineData,
  matchData,
  currentFrame,
  setCurrentFrame,
}: MapTimelineProps) {
  // Get frames from timeline data
  const frames = timelineData?.info?.frames || [];
  const totalFrames = frames.length;

  // Get current frame
  const frame = frames[currentFrame] || null;

  // Create a map of participant ID to champion name and team
  // Timeline uses participant IDs 1-10, which correspond to participants array indices
  const participantMap = new Map<number, string>();
  const participantTeamMap = new Map<number, number>(); // participantId -> teamId
  matchData.info.participants.forEach((p, index) => {
    // Participant IDs in timeline are 1-indexed
    participantMap.set(index + 1, p.championName);
    participantTeamMap.set(index + 1, p.teamId);
  });

  // Extract champion positions from current frame
  const championPositions: Array<{
    championName: string;
    x: number;
    y: number;
    participantId: number;
    teamId: number;
    isDead: boolean;
  }> = [];

  if (frame && frame.participantFrames) {
    Object.entries(frame.participantFrames).forEach(
      ([participantId, participantFrame]: [string, any]) => {
        const pid = parseInt(participantId);
        const championName = participantMap.get(pid);
        const teamId = participantTeamMap.get(pid);
        if (championName && participantFrame.position && teamId) {
          // Check if champion is dead (health is 0 or null)
          const health =
            participantFrame.championStats?.currentHealth ??
            participantFrame.championStats?.health ??
            null;
          const isDead = health === 0 || health === null;

          championPositions.push({
            championName,
            x: participantFrame.position.x,
            y: participantFrame.position.y,
            participantId: pid,
            teamId,
            isDead,
          });
        }
      }
    );
  }

  // Convert game coordinates to map coordinates
  // League of Legends map coordinates range from 0 to 15000 in both directions
  // Total map size is 15000 x 15000 in game units
  // (0, 0) is bottom-left (Blue fountain)
  // (15000, 15000) is top-right (Red fountain)
  const mapMinX = -1000;
  const mapMaxX = 14500;
  const mapMinY = -1000;
  const mapMaxY = 14500;
  const mapWidth = mapMaxX - mapMinX; // 15000
  const mapHeight = mapMaxY - mapMinY; // 15000

  // Format time for display
  const formatTime = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60000);
    const seconds = Math.floor((timestamp % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Console log champion positions on frame change
  useEffect(() => {
    if (championPositions.length > 0) {
      console.log(`\n=== Frame ${currentFrame + 1} / ${totalFrames} ===`);
      console.log(`Timestamp: ${frame ? formatTime(frame.timestamp) : "N/A"}`);
      console.log(`Champion Positions (${championPositions.length}):`);
      championPositions.forEach((pos) => {
        const xPercent = ((pos.x - mapMinX) / mapWidth) * 100;
        const yPercent = 100 - ((pos.y - mapMinY) / mapHeight) * 100;
        console.log(
          `  ${pos.championName} (ID: ${pos.participantId}): ` +
            `game(${pos.x}, ${pos.y}) → screen(${xPercent.toFixed(2)}%, ${yPercent.toFixed(2)}%) ` +
            `${pos.isDead ? "[DEAD]" : "[ALIVE]"}`
        );
      });
    }
  }, [
    currentFrame,
    totalFrames,
    frame,
    mapWidth,
    mapHeight,
    mapMinX,
    mapMinY,
    championPositions,
  ]);

  return (
    <div className="mt-6 w-full">
      {/* Slider Controls */}
      <div className="bg-[#1a2332] rounded-xl p-4 border border-[#2a3544]/50 shadow-lg">
        <div className="flex items-center gap-4">
          {/* Previous Button */}
          <button
            onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
            disabled={currentFrame === 0}
            className="w-10 h-10 flex items-center justify-center bg-[#0f1923] hover:bg-[#1a2332] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#0f1923] rounded-lg border border-[#2a3544]/50 transition-all text-white"
            aria-label="Previous frame"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Progress Bar / Slider */}
          <div className="flex-1 relative">
            <input
              type="range"
              min="0"
              max={Math.max(0, totalFrames - 1)}
              value={currentFrame}
              onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
              className="timeline-slider w-full"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                  (currentFrame / Math.max(1, totalFrames - 1)) * 100
                }%, #1a2332 ${
                  (currentFrame / Math.max(1, totalFrames - 1)) * 100
                }%, #1a2332 100%)`,
              }}
            />
          </div>

          {/* Next Button */}
          <button
            onClick={() =>
              setCurrentFrame(Math.min(totalFrames - 1, currentFrame + 1))
            }
            disabled={currentFrame >= totalFrames - 1}
            className="w-10 h-10 flex items-center justify-center bg-[#0f1923] hover:bg-[#1a2332] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#0f1923] rounded-lg border border-[#2a3544]/50 transition-all text-white"
            aria-label="Next frame"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Frame Info */}
          <div className="flex items-center gap-3 min-w-[140px]">
            <div className="text-sm font-semibold text-white">
              {currentFrame + 1} / {totalFrames}
            </div>
            {frame && (
              <div className="text-sm text-gray-400 font-mono">
                {formatTime(frame.timestamp)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map with Champion Positions */}
      <div className="relative w-full bg-[#0a1428] rounded-lg overflow-hidden">
        <Image
          src="/Base.png"
          alt="League of Legends Map"
          width={1920}
          height={1080}
          className="w-full h-auto object-contain"
          unoptimized
        />
        {/* Overlay Champion Icons */}
        <div className="absolute inset-0 pointer-events-none">
          {championPositions.map((pos) => {
            // Convert game coordinates to percentage
            // Game coordinates range from 0 to ~15000
            // (0, 0) is bottom-left, (15000, 15000) is top-right
            // Note: Game Y-axis increases upward, but CSS top increases downward, so we invert Y
            // Account for mapMin offsets in the calculation
            const xPercent = ((pos.x - mapMinX) / mapWidth) * 100;
            const yPercent = 100 - ((pos.y - mapMinY) / mapHeight) * 100; // Invert Y-axis

            // Apply fine-tuning offsets to align with map image
            // Shift icons down and to the left to match visual map positioning
            const xOffset = -5; // Shift left by 5%
            const yOffset = 3; // Shift down by 3%

            return (
              <div
                key={pos.participantId}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${xPercent + xOffset}%`,
                  top: `${yPercent + yOffset}%`,
                }}
              >
                <Image
                  src={getChampionImageUrl(pos.championName)}
                  alt={pos.championName}
                  width={32}
                  height={32}
                  className={`w-16 h-16 rounded-full border-4 shadow-lg ${
                    pos.teamId === 100 ? "border-blue-400" : "border-red-400"
                  } ${pos.isDead ? "grayscale opacity-60" : ""}`}
                  unoptimized
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface PlayerRowProps {
  player: any;
  matchData: MatchData;
  summonerSpellCache: Map<number, { image: { full: string } }> | null;
  runeCache: Map<number, { icon: string }> | null;
  runeStyleCache: Map<number, { icon: string }> | null;
}

function PlayerRow({
  player,
  matchData,
  summonerSpellCache,
  runeCache,
  runeStyleCache,
}: PlayerRowProps) {
  // Get rank label
  const getRankLabel = (rank: number) => {
    if (rank === 1) return "MVP";
    if (rank === 10) return "ACE";
    const suffix = rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
    return `${rank}${suffix}`;
  };

  // Get summoner spell images
  const summoner1Spell = summonerSpellCache?.get(player.summoner1Id);
  const summoner2Spell = summonerSpellCache?.get(player.summoner2Id);
  const summoner1Image = summoner1Spell
    ? getSummonerSpellImageUrl(summoner1Spell.image.full)
    : null;
  const summoner2Image = summoner2Spell
    ? getSummonerSpellImageUrl(summoner2Spell.image.full)
    : null;

  // Get runes
  let primaryKeystoneImage: string | null = null;
  let secondaryStyleImage: string | null = null;

  if (player.perks?.styles && player.perks.styles.length > 0) {
    const primaryStyle = player.perks.styles[0];
    if (primaryStyle.selections && primaryStyle.selections.length > 0) {
      const keystoneId = primaryStyle.selections[0].perk;
      if (keystoneId) {
        const keystone = runeCache?.get(keystoneId);
        if (keystone) {
          primaryKeystoneImage = getRuneImageUrl(keystone.icon);
        }
      }
    }

    if (player.perks.styles.length > 1) {
      const secondaryStyle = player.perks.styles[1];
      const secondaryStyleId = secondaryStyle.style;
      if (secondaryStyleId) {
        const style = runeStyleCache?.get(secondaryStyleId);
        if (style) {
          secondaryStyleImage = getRuneImageUrl(style.icon);
        }
      }
    }
  }

  // Get items - use same sorting method as MatchCard
  const rawItems = [
    player.item0,
    player.item1,
    player.item2,
    player.item3,
    player.item4,
    player.item5,
  ];
  // Sort items by item ID in descending order
  const sortedItems = [...rawItems].sort((a, b) => b - a);
  // Reorder to put boots first if they exist
  const reorderedItems = reorderItemsWithBootsFirst(sortedItems);
  // Filter out empty items and pad with empty slots at the end to always have 6 slots
  const filledItems = reorderedItems.filter((item) => item > 0);
  const emptySlots = 6 - filledItems.length;
  const items = [...filledItems, ...Array(emptySlots).fill(0)];
  const trinket = player.item6;

  // Calculate KDA
  const kda = `${player.kills}/${player.deaths}/${player.assists}`;
  const kdaRatio =
    player.deaths > 0
      ? ((player.kills + player.assists) / player.deaths).toFixed(2)
      : "Perfect";

  // Calculate CS
  const cs = player.totalMinionsKilled + player.neutralMinionsKilled;
  const csPerMin = (cs / (matchData.info.gameDuration / 60)).toFixed(1);

  // Calculate gold
  const gold = player.goldEarned;
  const goldK = (gold / 1000).toFixed(1);
  const goldPerMin = (gold / (matchData.info.gameDuration / 60)).toFixed(0);

  // Get damage dealt (if available)
  const damageDealt = player.totalDamageDealtToChampions || 0;
  const damageK = (damageDealt / 1000).toFixed(1);

  // Calculate vision score per minute
  const visionScore = player.visionScore || 0;
  const visionPerMin = (
    visionScore /
    (matchData.info.gameDuration / 60)
  ).toFixed(1);

  return (
    <div className="bg-[#1e2a3a] rounded p-1.5 border border-[#2a3a4a] hover:bg-[#253040] transition-colors">
      <div className="flex items-center gap-1.5">
        {/* Rank Badge */}
        <div className="w-6 flex-shrink-0">
          <div className="text-[10px] font-bold text-white text-center">
            {getRankLabel(player.rank)}
          </div>
        </div>

        {/* Champion & Player Info */}
        <div className="flex items-center gap-1.5 w-[140px] flex-shrink-0">
          <div className="relative w-8 h-8 rounded overflow-hidden border border-[#3a4a5a] flex-shrink-0">
            <Image
              src={getChampionImageUrl(player.championName)}
              alt={player.championName}
              width={32}
              height={32}
              className="object-cover"
              unoptimized
            />
            {/* Role Icon */}
            {player.teamPosition && (
              <div className="absolute bottom-0 left-0 w-3 h-3 rounded-sm overflow-hidden border border-[#1a1a1a] bg-[#1a1a1a]">
                <Image
                  src={getRoleIconUrl(player.teamPosition)}
                  alt={player.teamPosition}
                  width={12}
                  height={12}
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            {/* Level */}
            <div className="absolute top-0 right-0 bg-black/90 rounded-bl px-0.5 text-[8px] text-white font-bold">
              {player.champLevel || 1}
            </div>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="text-[10px] font-semibold text-white truncate">
              {player.riotIdGameName || player.summonerName || "Unknown"}
            </div>
            <div className="text-[8px] text-gray-400 truncate">
              {player.championName}
            </div>
          </div>
        </div>

        {/* Summoner Spells */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          {summoner1Image ? (
            <div className="relative w-4 h-4 rounded border border-[#3a4a5a] overflow-hidden">
              <Image
                src={summoner1Image}
                alt="Summoner Spell 1"
                width={16}
                height={16}
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-4 h-4" />
          )}
          {summoner2Image ? (
            <div className="relative w-4 h-4 rounded border border-[#3a4a5a] overflow-hidden">
              <Image
                src={summoner2Image}
                alt="Summoner Spell 2"
                width={16}
                height={16}
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>

        {/* Runes */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          {primaryKeystoneImage ? (
            <div className="relative w-5 h-5 rounded border border-[#3a4a5a] overflow-hidden bg-[#0a0e14]">
              <Image
                src={primaryKeystoneImage}
                alt="Keystone"
                width={20}
                height={20}
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-5 h-5" />
          )}
          {secondaryStyleImage ? (
            <div className="relative w-4 h-4 rounded border border-[#3a4a5a] overflow-hidden bg-[#0a0e14]">
              <Image
                src={secondaryStyleImage}
                alt="Secondary Tree"
                width={16}
                height={16}
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>

        {/* Items */}
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          {items.map((item, idx) =>
            item > 0 ? (
              <div
                key={idx}
                className="relative w-5 h-5 bg-[#0a0e14] rounded border border-[#3a4a5a] overflow-hidden"
              >
                <Image
                  src={getItemImageUrl(item)}
                  alt={`Item ${item}`}
                  width={20}
                  height={20}
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div
                key={idx}
                className="w-5 h-5 bg-[#0a0e14] rounded border border-[#2a3a4a]"
              />
            )
          )}
          {trinket > 0 ? (
            <div className="relative w-5 h-5 bg-[#0a0e14] rounded border border-[#3a4a5a] overflow-hidden ml-0.5">
              <Image
                src={getItemImageUrl(trinket)}
                alt="Trinket"
                width={20}
                height={20}
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-5 h-5 bg-[#0a0e14] rounded border border-[#2a3a4a] ml-0.5" />
          )}
        </div>

        {/* KDA */}
        <div className="text-center min-w-[50px] flex-shrink-0">
          <div className="text-xs font-semibold text-white">{kda}</div>
          <div className="text-[8px] text-gray-400">{kdaRatio}</div>
        </div>

        {/* KP */}
        <div className="text-center min-w-[40px] flex-shrink-0">
          <div className="text-xs font-semibold text-white">
            {player.challenges?.killParticipation
              ? `${Math.round(player.challenges.killParticipation * 100)}%`
              : "N/A"}
          </div>
          <div className="text-[8px] text-gray-400">KP</div>
        </div>

        {/* CS/min or Vision/min */}
        {player.teamPosition === "UTILITY" ? (
          <div className="text-center min-w-[45px] flex-shrink-0">
            <div className="text-xs font-semibold text-white">
              {visionPerMin}
            </div>
            <div className="text-[8px] text-gray-400">VS/min</div>
          </div>
        ) : (
          <div className="text-center min-w-[45px] flex-shrink-0">
            <div className="text-xs font-semibold text-white">{csPerMin}</div>
            <div className="text-[8px] text-gray-400">CS/min</div>
          </div>
        )}

        {/* Damage */}
        <div className="text-center min-w-[50px] flex-shrink-0">
          <div className="text-xs font-semibold text-white">{damageK}K</div>
          <div className="text-[8px] text-gray-400">Dmg</div>
        </div>

        {/* Gold */}
        <div className="text-center min-w-[50px] flex-shrink-0">
          <div className="text-xs font-semibold text-white">{goldPerMin}</div>
          <div className="text-[8px] text-gray-400">G/min</div>
        </div>

        {/* Performance Score */}
        <div className="flex items-center min-w-[70px] flex-shrink-0 ml-auto">
          <PerformanceScore
            score={player.score}
            rank={player.rank}
            totalPlayers={matchData.info.participants.length}
          />
        </div>
      </div>
    </div>
  );
}
