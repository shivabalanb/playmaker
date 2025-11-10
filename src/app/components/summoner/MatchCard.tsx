"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import { MatchData } from "./types";
import {
  getSummonerSpellImageUrl,
  getRuneImageUrl,
  getRoleIconUrl,
  DD_VERSION,
} from "@/lib";
import { calculatePlayerRank } from "@/lib/utils/performanceScore";
import { getPerformanceTags } from "@/lib/utils/performanceTags";
import { PerformanceScore } from "./PerformanceScore";

interface MatchCardProps {
  match: MatchData;
  puuid: string;
  region?: string;
  getChampionImageUrl: (championName: string) => string;
  getItemImageUrl: (itemId: number) => string;
  getQueueType: (queueId: number) => string;
  isRankedQueue: (queueId: number) => boolean;
  isReviewableQueue: (queueId: number) => boolean;
  formatDuration: (seconds: number) => string;
  formatTimeAgo: (timestamp: number) => string;
  reorderItemsWithBootsFirst: (items: number[]) => number[];
}

// Cache for summoner spells data
let summonerSpellCache: Map<number, { image: { full: string } }> | null = null;

// Cache for runes data (rune ID -> rune data)
let runeCache: Map<number, { icon: string }> | null = null;

// Cache for rune styles data (style ID -> style data)
let runeStyleCache: Map<number, { icon: string }> | null = null;

export function MatchCard({
  match,
  puuid,
  region = "americas",
  getChampionImageUrl,
  getItemImageUrl,
  getQueueType,
  isRankedQueue,
  isReviewableQueue,
  formatDuration,
  formatTimeAgo,
  reorderItemsWithBootsFirst,
}: MatchCardProps) {
  const router = useRouter();
  const playerData = match.info.participants.find((p) => p.puuid === puuid);
  if (!playerData) return null;

  const [summonerSpellsLoaded, setSummonerSpellsLoaded] = useState(false);
  const [runesLoaded, setRunesLoaded] = useState(false);
  const championImageRef = useRef<HTMLDivElement>(null);

  // Fetch and cache summoner spells data
  useEffect(() => {
    if (summonerSpellCache) {
      setSummonerSpellsLoaded(true);
      return;
    }

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
        setSummonerSpellsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to fetch summoner spells:", err);
        setSummonerSpellsLoaded(true); // Set to true anyway to avoid infinite loading
      });
  }, []);

  // Fetch and cache runes data
  useEffect(() => {
    if (runeCache && runeStyleCache) {
      setRunesLoaded(true);
      return;
    }

    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/data/en_US/runesReforged.json`
    )
      .then((res) => res.json())
      .then((data) => {
        const runeMap = new Map<number, { icon: string }>();
        const styleMap = new Map<number, { icon: string }>();
        // Data Dragon returns an array of rune trees (styles)
        for (const style of data) {
          // Cache the style itself (for secondary tree icon)
          styleMap.set(style.id, { icon: style.icon });
          // Add all runes in each slot
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
        setRunesLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to fetch runes:", err);
        setRunesLoaded(true); // Set to true anyway to avoid infinite loading
      });
  }, []);

  const isVictory = playerData.win;
  const kda = `${playerData.kills}/${playerData.deaths}/${playerData.assists}`;
  const cs = playerData.totalMinionsKilled + playerData.neutralMinionsKilled;
  
  // Calculate per-minute stats
  const gameDurationMinutes = match.info.gameDuration / 60;
  const csPerMin = (cs / gameDurationMinutes).toFixed(1);
  const goldPerMin = (playerData.goldEarned / gameDurationMinutes / 1000).toFixed(1);

  // Get performance tags and randomly select 5
  const allTags = useMemo(() => getPerformanceTags(playerData, match.info.gameDuration), [playerData, match.info.gameDuration]);
  const displayedTags = useMemo(() => {
    if (allTags.length === 0) return [];
    const shuffled = [...allTags].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(5, allTags.length));
  }, [allTags]);

  // Calculate performance score and rank
  const performanceData = useMemo(() => {
    try {
      return calculatePlayerRank(
        puuid,
        match.info.participants,
        match.info.gameDuration
      );
    } catch (error) {
      console.error("Error calculating performance score:", error);
      return { score: 0, rank: 0 };
    }
  }, [puuid, match.info.participants, match.info.gameDuration]);


  // Get summoner spell image URLs
  const summoner1Spell = summonerSpellCache?.get(playerData.summoner1Id);
  const summoner2Spell = summonerSpellCache?.get(playerData.summoner2Id);
  const summoner1Image = summoner1Spell
    ? getSummonerSpellImageUrl(summoner1Spell.image.full)
    : null;
  const summoner2Image = summoner2Spell
    ? getSummonerSpellImageUrl(summoner2Spell.image.full)
    : null;

  // Extract primary keystone and secondary style
  let primaryKeystoneImage: string | null = null;
  let secondaryStyleImage: string | null = null;

  if (playerData.perks?.styles && playerData.perks.styles.length > 0) {
    // Primary keystone (first rune from first style)
    const primaryStyle = playerData.perks.styles[0];
    if (primaryStyle.selections && primaryStyle.selections.length > 0) {
      const keystoneId = primaryStyle.selections[0].perk;
      if (keystoneId) {
        const keystone = runeCache?.get(keystoneId);
        if (keystone) {
          primaryKeystoneImage = getRuneImageUrl(keystone.icon);
        }
      }
    }

    // Secondary style icon (the tree itself, not the runes)
    if (playerData.perks.styles.length > 1) {
      const secondaryStyle = playerData.perks.styles[1];
      const secondaryStyleId = secondaryStyle.style;
      if (secondaryStyleId) {
        const style = runeStyleCache?.get(secondaryStyleId);
        if (style) {
          secondaryStyleImage = getRuneImageUrl(style.icon);
        }
      }
    }
  }

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

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("matchId", match.metadata.matchId);
    e.dataTransfer.setData("championName", playerData.championName);
    e.dataTransfer.setData("championImageUrl", getChampionImageUrl(playerData.championName));
    e.dataTransfer.setData("kda", kda);
    e.dataTransfer.setData("isVictory", isVictory.toString());
    
    // Create custom drag preview with champion icon, KDA, and win/loss background
    const dragPreview = document.createElement("div");
    dragPreview.style.position = "absolute";
    dragPreview.style.top = "-9999px";
    dragPreview.style.left = "-9999px";
    dragPreview.style.width = "80px";
    dragPreview.style.height = "80px";
    dragPreview.style.borderRadius = "8px";
    dragPreview.style.overflow = "hidden";
    dragPreview.style.border = "2px solid rgba(255, 255, 255, 0.2)";
    dragPreview.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
    dragPreview.style.background = isVictory 
      ? "linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(22, 163, 74, 0.9) 100%)"
      : "linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%)";
    
    // Champion image
    const championImg = document.createElement("img");
    championImg.src = getChampionImageUrl(playerData.championName);
    championImg.style.width = "100%";
    championImg.style.height = "100%";
    championImg.style.objectFit = "cover";
    championImg.style.opacity = "0.7";
    dragPreview.appendChild(championImg);
    
    // KDA overlay
    const kdaOverlay = document.createElement("div");
    kdaOverlay.style.position = "absolute";
    kdaOverlay.style.bottom = "0";
    kdaOverlay.style.left = "0";
    kdaOverlay.style.right = "0";
    kdaOverlay.style.background = "rgba(0, 0, 0, 0.8)";
    kdaOverlay.style.padding = "4px";
    kdaOverlay.style.textAlign = "center";
    kdaOverlay.style.fontSize = "11px";
    kdaOverlay.style.fontWeight = "bold";
    kdaOverlay.style.color = "white";
    kdaOverlay.style.fontFamily = "system-ui, -apple-system, sans-serif";
    kdaOverlay.textContent = kda;
    dragPreview.appendChild(kdaOverlay);
    
    document.body.appendChild(dragPreview);
    
    // Use custom drag preview
    e.dataTransfer.setDragImage(dragPreview, 40, 40);
    
    // Clean up after drag starts
    setTimeout(() => {
      document.body.removeChild(dragPreview);
    }, 0);
  };

  return (
    <div
      data-match-id={match.metadata.matchId}
      draggable
      onDragStart={handleDragStart}
      className={`relative border-l-4 ${
        isVictory ? "border-green-500" : "border-red-500 "
      } rounded-lg py-4 px-[26px] transition-colors overflow-visible cursor-grab active:cursor-grabbing`}
    >
      {/* Base background */}
      <div className="absolute inset-0 bg-[#1e2a3a] -z-10" />
      {/* Background pattern texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      />
      {/* Background with color theme - softer */}
      <div
        className={`absolute inset-0 ${
          isVictory
            ? "bg-gradient-to-r from-green-500/8 via-green-500/5 to-green-500/2"
            : "bg-gradient-to-r from-red-500/8 via-red-500/5 to-red-500/2"
        }`}
      />
      {/* Softening pattern for left side - more gradual */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(ellipse 200% 100% at 0% 50%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 30%, transparent 70%)`,
        }}
      />
      {/* Content container */}
      <div className="relative z-10 flex items-center gap-6 hover:opacity-90 transition-opacity">
        {/* Champion and Result */}
        <div className="flex items-center gap-4 w-[320px] h-16 flex-shrink-0">
          {/* Champion Icon with Summoner Spells */}
          <div className="flex items-center gap-2 shrink-0 h-full">
            <div 
              ref={championImageRef}
              className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-[#3a4a5a]"
            >
              <Image
                src={getChampionImageUrl(playerData.championName)}
                alt={playerData.championName}
                width={48}
                height={48}
                className="object-cover"
                unoptimized
              />
              {/* Role Icon Overlay */}
              {playerData.teamPosition && (
                <div className="absolute bottom-0 left-0 w-5 h-5 rounded-sm overflow-hidden border border-[#1a1a1a] bg-[#1a1a1a]">
                  <Image
                    src={getRoleIconUrl(playerData.teamPosition)}
                    alt={playerData.teamPosition}
                    width={20}
                    height={20}
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
            </div>
            {/* Summoner Spells */}
            <div className="flex flex-col gap-1 w-[20px] flex-shrink-0">
              {summoner1Image ? (
                <div className="relative w-5 h-5 rounded border border-[#3a4a5a] overflow-hidden">
                  <Image
                    src={summoner1Image}
                    alt="Summoner Spell 1"
                    width={20}
                    height={20}
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-5 h-5" />
              )}
              {summoner2Image ? (
                <div className="relative w-5 h-5 rounded border border-[#3a4a5a] overflow-hidden">
                  <Image
                    src={summoner2Image}
                    alt="Summoner Spell 2"
                    width={20}
                    height={20}
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-0.5 flex-1 h-full justify-center">
            <div className="flex items-center gap-3 min-h-[20px]">
              <span className="text-base font-semibold text-white w-[120px] truncate">
                {playerData.championName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 min-h-[16px] flex-wrap">
              <span
                className={`whitespace-nowrap ${
                  isRankedQueue(match.info.queueId)
                    ? "text-gray-300"
                    : "text-gray-500"
                }`}
              >
                {getQueueType(match.info.queueId)}
              </span>
              <span className="whitespace-nowrap">•</span>
              <span className="whitespace-nowrap">
                {formatDuration(match.info.gameDuration)}
              </span>
              <span className="whitespace-nowrap">•</span>
              <span className="whitespace-nowrap" suppressHydrationWarning>
                {formatTimeAgo(match.info.gameCreation)}
              </span>
            </div>
          </div>
        </div>

        {/* KDA */}
        <div className="flex flex-col items-center justify-center w-[90px] h-16 flex-shrink-0">
          <div className="text-lg font-bold text-white">{kda}</div>
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

        {/* Items and Runes */}
        <div className="flex items-center gap-1.5 w-[180px] h-16 flex-shrink-0">
          {/* Runes - Primary Keystone and Secondary Tree */}
          <div className="flex flex-col gap-1 w-[28px] flex-shrink-0">
            {/* Primary Keystone */}
            {primaryKeystoneImage ? (
              <div className="relative w-7 h-7 rounded border border-[#3a4a5a] overflow-hidden bg-[#0a0e14]">
                <Image
                  src={primaryKeystoneImage}
                  alt="Keystone"
                  width={28}
                  height={28}
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-7 h-7" />
            )}
            {/* Secondary Tree Icon */}
            {secondaryStyleImage ? (
              <div className="relative w-6 h-6 rounded border border-[#3a4a5a] overflow-hidden bg-[#0a0e14]">
                <Image
                  src={secondaryStyleImage}
                  alt="Secondary Tree"
                  width={24}
                  height={24}
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-6 h-6" />
            )}
          </div>

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

          {/* Trinket (separate on the right) */}
          <div className="flex flex-col justify-start">
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

        {/* Performance Tags */}
        {displayedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center max-w-[240px] h-16 flex-shrink-0 overflow-visible px-2">
            {displayedTags.map((tag, idx) => (
              <div
                key={idx}
                className={`relative group px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${tag.color} cursor-default`}
              >
                {tag.name}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg border border-gray-700">
                  {tag.description}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-300 h-16">
          {/* Only show stats for Ranked and Normal queues, but not ARAM */}
          {isReviewableQueue(match.info.queueId) && match.info.queueId !== 450 && (
            <>
              <div className="text-center">
                <div className="font-semibold">{csPerMin}</div>
                <div className="text-gray-500">CS/min</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">
                  {goldPerMin}k
                </div>
                <div className="text-gray-500">Gold/min</div>
              </div>
              {/* Performance Score */}
              <div className="flex items-center">
                <PerformanceScore
                  score={performanceData.score}
                  rank={performanceData.rank}
                  totalPlayers={match.info.participants.length}
                />
              </div>
            </>
          )}
          {/* Empty spacer for ARAM to maintain alignment */}
          {match.info.queueId === 450 && (
            <div className="w-[200px]" />
          )}
        </div>

        {/* Review Button - Absolutely positioned */}
        {isReviewableQueue(match.info.queueId) && (
          <button
            onClick={(e) => {
              e.preventDefault();
              // Navigate to match detail page
              const url = `/match/${match.metadata.matchId}?region=${region}${puuid ? `&puuid=${encodeURIComponent(puuid)}` : ""}`;
              router.push(url);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all cursor-pointer bg-gray-700/30 hover:bg-gray-600/40 z-20"
            aria-label="View match details"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
