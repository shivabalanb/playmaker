"use client";

import { useEffect, useState, useRef } from "react";
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
  const puuid = searchParams.get("puuid"); // Optional - for analyzing specific player
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  // Match analysis for AI insights (will be used for LLM context)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [matchAnalysis, setMatchAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedPlayerPuuid, setSelectedPlayerPuuid] = useState<string | null>(
    puuid || null
  );

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
        return fetch(`/api/riot/match/timeline`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            matches: [{ matchId, region }],
          }),
        });
      })
      .then((res) => {
        if (!res) return;
        return res.json();
      })
      .then((response) => {
        if (response && !response.error) {
          const result = response.results?.[0];
          if (result?.success && result.timelineData) {
            setTimelineData(result.timelineData);
          } else if (result && !result.success) {
            console.error("Timeline fetch failed:", result.error);
            setError(result.error || "Failed to load timeline data");
          }
        } else if (response?.error) {
          setError(response.error);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error loading match data:", err);
        setError("Failed to load match data");
        setIsLoading(false);
      });
  }, [matchId, region]);

  // Fetch match analysis (similar to player-analysis)
  useEffect(() => {
    if (!matchData || !puuid) return; // Only fetch if we have match data and puuid

    const fetchMatchAnalysis = async () => {
      setIsLoadingAnalysis(true);
      try {
        const response = await fetch(`/api/riot/match-analysis`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            matchId,
            region,
            puuid,
          }),
        });

        if (response.ok) {
          const analysis = await response.json();
          setMatchAnalysis(analysis);
          console.log("Match analysis loaded:", analysis);
        } else {
          console.error("Failed to fetch match analysis:", response.status);
        }
      } catch (err) {
        console.error("Error fetching match analysis:", err);
      } finally {
        setIsLoadingAnalysis(false);
      }
    };

    fetchMatchAnalysis();
  }, [matchData, matchId, region, puuid]);

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
          {/* Column Headers */}
          <div className="flex items-center gap-1.5 px-1.5 pb-1 text-[10px] text-gray-500 font-semibold">
            <div className="w-6 flex-shrink-0"></div>
            <div className="w-[140px] flex-shrink-0"></div>
            <div className="flex-shrink-0" style={{ width: '16px' }}></div>
            <div className="flex-shrink-0" style={{ width: '20px' }}></div>
            <div className="flex-shrink-0 ml-2" style={{ width: '150px' }}></div>
            <div className="text-center min-w-[63px] flex-shrink-0">KDA</div>
            <div className="text-center min-w-[25px] flex-shrink-0">KP</div>
            <div className="text-center min-w-[60px] flex-shrink-0">CS</div>
            <div className="text-center min-w-[35px] flex-shrink-0">GOLD</div>
            <div className="text-center min-w-[180px] flex-shrink-0 pl-6">DAMAGE</div>
            <div className="min-w-[70px] flex-shrink-0 ml-auto"></div>
          </div>
          <div className="space-y-0.5">
            {sortPlayersByRole(
              allPlayerScores.filter((p) => p.teamId === 100)
            ).map((player) => (
              <PlayerRow
                key={player.puuid}
                player={player}
                matchData={matchData}
                region={region}
                summonerSpellCache={summonerSpellCache}
                runeCache={runeCache}
                runeStyleCache={runeStyleCache}
                isSelected={selectedPlayerPuuid === player.puuid}
                onClick={() => setSelectedPlayerPuuid(player.puuid)}
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
          {/* Column Headers */}
          <div className="flex items-center gap-1.5 px-1.5 pb-1 text-[10px] text-gray-500 font-semibold">
            <div className="w-6 flex-shrink-0"></div>
            <div className="w-[140px] flex-shrink-0"></div>
            <div className="flex-shrink-0" style={{ width: '16px' }}></div>
            <div className="flex-shrink-0" style={{ width: '20px' }}></div>
            <div className="flex-shrink-0 ml-2" style={{ width: '150px' }}></div>
            <div className="text-center min-w-[63px] flex-shrink-0">KDA</div>
            <div className="text-center min-w-[25px] flex-shrink-0">KP</div>
            <div className="text-center min-w-[60px] flex-shrink-0">CS</div>
            <div className="text-center min-w-[35px] flex-shrink-0">GOLD</div>
            <div className="text-center min-w-[180px] flex-shrink-0 pl-6">DAMAGE</div>
            <div className="min-w-[70px] flex-shrink-0 ml-auto"></div>
          </div>
          <div className="space-y-0.5">
            {sortPlayersByRole(
              allPlayerScores.filter((p) => p.teamId === 200)
            ).map((player) => (
              <PlayerRow
                key={player.puuid}
                player={player}
                matchData={matchData}
                region={region}
                summonerSpellCache={summonerSpellCache}
                runeCache={runeCache}
                runeStyleCache={runeStyleCache}
                isSelected={selectedPlayerPuuid === player.puuid}
                onClick={() => setSelectedPlayerPuuid(player.puuid)}
              />
            ))}
          </div>
        </div>

        {/* Player Purchase Timeline */}
        {selectedPlayerPuuid && timelineData && matchData && (
          <PlayerPurchaseTimeline
            selectedPlayerPuuid={selectedPlayerPuuid}
            timelineData={timelineData}
            matchData={matchData}
          />
        )}

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

interface PlayerPurchaseTimelineProps {
  selectedPlayerPuuid: string;
  timelineData: any;
  matchData: MatchData;
}

function PlayerPurchaseTimeline({
  selectedPlayerPuuid,
  timelineData,
  matchData,
}: PlayerPurchaseTimelineProps) {
  // Find selected player data
  const selectedPlayer = matchData.info.participants.find(
    (p) => p.puuid === selectedPlayerPuuid
  );

  if (!selectedPlayer) return null;

  // Get participantId (1-indexed in timeline data)
  const participantId =
    matchData.info.participants.findIndex((p) => p.puuid === selectedPlayerPuuid) + 1;

  // Track item purchases, sales, and undos
  const itemEvents: Array<{ 
    timestamp: number; 
    itemId: number;
    participantId: number;
    type: 'PURCHASE' | 'SELL' | 'UNDO';
  }> = [];
  
  if (timelineData && timelineData.info && timelineData.info.frames) {
    timelineData.info.frames.forEach((frame: any) => {
      if (frame.events) {
        frame.events.forEach((event: any) => {
          if (event.participantId === participantId) {
            if (event.type === "ITEM_PURCHASED") {
              itemEvents.push({
                timestamp: event.timestamp,
                itemId: event.itemId,
                participantId: event.participantId,
                type: 'PURCHASE'
              });
            } else if (event.type === "ITEM_SOLD") {
              itemEvents.push({
                timestamp: event.timestamp,
                itemId: event.itemId,
                participantId: event.participantId,
                type: 'SELL'
              });
            } else if (event.type === "ITEM_UNDO") {
              itemEvents.push({
                timestamp: event.timestamp,
                itemId: event.beforeId, // Use beforeId for undo events
                participantId: event.participantId,
                type: 'UNDO'
              });
            }
          }
        });
      }
    });
  }

  // Process events to get final item purchases
  const finalPurchases: Array<{ timestamp: number; itemId: number; participantId: number }> = [];
  
  // Keep track of all events for proper undo handling
  const eventStack: Array<{
    type: 'PURCHASE' | 'SELL';
    timestamp: number;
    itemId: number;
    participantId: number;
  }> = [];

  // Debug log for events
  console.log('Item Events:', itemEvents.map(event => ({
    ...event,
    time: Math.floor(event.timestamp / 60000) + ':' + String(Math.floor((event.timestamp % 60000) / 1000)).padStart(2, '0'),
  })));

  itemEvents.forEach((event) => {
    if (event.type === 'PURCHASE') {
      console.log(`Purchase at ${Math.floor(event.timestamp / 60000)}:${String(Math.floor((event.timestamp % 60000) / 1000)).padStart(2, '0')} - Item ${event.itemId}`);
      finalPurchases.push({
        timestamp: event.timestamp,
        itemId: event.itemId,
        participantId: event.participantId
      });
      eventStack.push({
        type: 'PURCHASE',
        timestamp: event.timestamp,
        itemId: event.itemId,
        participantId: event.participantId
      });
    } else if (event.type === 'SELL') {
      // Find and remove the purchase from finalPurchases
      const purchaseIndex = finalPurchases.findIndex(p => p.itemId === event.itemId);
      if (purchaseIndex !== -1) {
        finalPurchases.splice(purchaseIndex, 1);
      }
      eventStack.push({
        type: 'SELL',
        timestamp: event.timestamp,
        itemId: event.itemId,
        participantId: event.participantId
      });
    } else if (event.type === 'UNDO') {
      // Find the most recent event for this participant, regardless of item
      const lastEventIndex = [...eventStack].reverse().findIndex(e => e.participantId === event.participantId);
      if (lastEventIndex !== -1) {
        const actualIndex = eventStack.length - 1 - lastEventIndex;
        const lastEvent = eventStack[actualIndex];
        
        // Remove the event from the stack
        eventStack.splice(actualIndex, 1);
        
        // Reverse the last action
        if (lastEvent.type === 'PURCHASE') {
          // Undo a purchase - remove from finalPurchases
          const purchaseIndex = finalPurchases.findIndex(p => 
            p.timestamp === lastEvent.timestamp && p.itemId === lastEvent.itemId
          );
          if (purchaseIndex !== -1) {
            finalPurchases.splice(purchaseIndex, 1);
          }
        } else if (lastEvent.type === 'SELL') {
          // Undo a sell - add back to finalPurchases
          // Find the most recent purchase of this item before the sell
          const originalPurchase = [...eventStack]
            .slice(0, actualIndex)
            .reverse()
            .find(e => 
              e.type === 'PURCHASE' && 
              e.itemId === lastEvent.itemId &&
              e.participantId === event.participantId
            );
          if (originalPurchase) {
            finalPurchases.push({
              timestamp: originalPurchase.timestamp,
              itemId: originalPurchase.itemId,
              participantId: originalPurchase.participantId
            });
          }
        }
      }
    }
  });

  // Group purchases within 5 seconds together
  const groupedPurchases: Array<{ timestamp: number; items: number[] }> = [];

  // Debug log for final purchases
  console.log('Final Purchases:', finalPurchases.map(purchase => ({
    ...purchase,
    time: Math.floor(purchase.timestamp / 60000) + ':' + String(Math.floor((purchase.timestamp % 60000) / 1000)).padStart(2, '0'),
  })));

  finalPurchases
    .sort((a, b) => a.timestamp - b.timestamp) // Ensure chronological order
    .forEach((purchase) => {
      const lastGroup = groupedPurchases[groupedPurchases.length - 1];
      
      // Log the current purchase and time gap with last group
      if (lastGroup) {
        console.log(
          `Purchase at ${Math.floor(purchase.timestamp / 60000)}:${String(Math.floor((purchase.timestamp % 60000) / 1000)).padStart(2, '0')} - ` +
          `Item ${purchase.itemId}, Time gap: ${(purchase.timestamp - lastGroup.timestamp) / 1000}s`
        );
      }

      // If no groups or timestamp difference > 5000ms, create new group
      if (!lastGroup || purchase.timestamp - lastGroup.timestamp > 5000) {
        groupedPurchases.push({
          timestamp: purchase.timestamp,
          items: [purchase.itemId],
        });
      } else {
        // Add to existing group
        lastGroup.items.push(purchase.itemId);
      }
    });

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#1a2332] rounded-lg p-4 border border-[#2a3a4a]">


      {groupedPurchases.length === 0 ? (
        <p className="text-sm text-gray-400">No purchases recorded</p>
      ) : (
        <div className="flex items-center gap-y-4 gap-x-0 flex-wrap">
          {groupedPurchases.map((group, idx) => (
            <div key={idx} className="flex items-center gap-0">
              <div className="flex items-center gap-2 bg-[#0f1821] p-2 rounded">
                <div className="text-xs font-mono text-gray-400 flex-shrink-0">
                  {formatTime(group.timestamp)}
                </div>
                <div className="flex items-center gap-1">
                  {group.items.map((itemId, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="relative w-8 h-8 bg-[#0a0e14] rounded border border-[#3a4a5a] flex-shrink-0"
                    >
                      <Image
                        src={getItemImageUrl(itemId)}
                        alt={`Item ${itemId}`}
                        width={32}
                        height={32}
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              </div>
              {idx < groupedPurchases.length - 1 && (
                <div className="w-8 h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
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

  const [hoveredChampion, setHoveredChampion] = useState<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Tower coordinates
  const towerPositions = {
    BLUE_TOP_LANE_OUTER_TURRET: { x: 981, y: 10641, team: 100, isNexus: false },
    BLUE_TOP_LANE_INNER_TURRET: { x: 1512, y: 6899, team: 100, isNexus: false },
    BLUE_TOP_LANE_BASE_TURRET: { x: 1169, y: 4487, team: 100, isNexus: false },
    BLUE_MID_LANE_OUTER_TURRET: { x: 5846, y: 6596, team: 100, isNexus: false },
    BLUE_MID_LANE_INNER_TURRET: { x: 5048, y: 5012, team: 100, isNexus: false },
    BLUE_MID_LANE_BASE_TURRET: { x: 3651, y: 3896, team: 100, isNexus: false },
    BLUE_BOT_LANE_OUTER_TURRET: { x: 10504, y: 1229, team: 100, isNexus: false },
    BLUE_BOT_LANE_INNER_TURRET: { x: 6919, y: 1683, team: 100, isNexus: false },
    BLUE_BOT_LANE_BASE_TURRET: { x: 4281, y: 1453, team: 100, isNexus: false },
    BLUE_TOP_LANE_NEXUS_TURRET: { x: 1748, y: 2470, team: 100, isNexus: true },
    BLUE_BOT_LANE_NEXUS_TURRET: { x: 2177, y: 2007, team: 100, isNexus: true },
    RED_TOP_LANE_OUTER_TURRET: { x: 4318, y: 14075, team: 200, isNexus: false },
    RED_TOP_LANE_INNER_TURRET: { x: 7943, y: 13611, team: 200, isNexus: false },
    RED_TOP_LANE_BASE_TURRET: { x: 10481, y: 13850, team: 200, isNexus: false },
    RED_MID_LANE_OUTER_TURRET: { x: 8955, y: 8710, team: 200, isNexus: false },
    RED_MID_LANE_INNER_TURRET: { x: 9767, y: 10313, team: 200, isNexus: false },
    RED_MID_LANE_BASE_TURRET: { x: 11134, y: 11407, team: 200, isNexus: false },
    RED_BOT_LANE_OUTER_TURRET: { x: 13866, y: 4705, team: 200, isNexus: false },
    RED_BOT_LANE_INNER_TURRET: { x: 13327, y: 8426, team: 200, isNexus: false },
    RED_BOT_LANE_BASE_TURRET: { x: 13624, y: 10772, team: 200, isNexus: false },
    RED_TOP_LANE_NEXUS_TURRET: { x: 12611, y: 13284, team: 200, isNexus: true },
    RED_BOT_LANE_NEXUS_TURRET: { x: 13052, y: 12812, team: 200, isNexus: true },
  };

  // Track tower destruction times
  const towerDestructions = useRef<Map<string, number>>(new Map());
  
  // Parse tower destruction events from timeline
  useEffect(() => {
    if (!timelineData) return;
    
    towerDestructions.current.clear();
    
    timelineData.info.frames.forEach((frame: any) => {
      if (frame.events) {
        frame.events.forEach((event: any) => {
          if (event.type === "BUILDING_KILL" && event.buildingType === "TOWER_BUILDING") {
            // Build tower name from event data
            const teamPrefix = event.teamId === 100 ? "BLUE" : "RED";
            const laneType = event.laneType; // TOP_LANE, MID_LANE, BOT_LANE
            const towerTier = event.towerType; // OUTER_TURRET, INNER_TURRET, BASE_TURRET, NEXUS_TURRET
            
            const towerName = `${teamPrefix}_${laneType}_${towerTier}`;
            console.log(`Tower destroyed: ${towerName} at ${event.timestamp}ms`, event);
            towerDestructions.current.set(towerName, event.timestamp);
          }
        });
      }
    });
    
    console.log("All tower destructions:", Array.from(towerDestructions.current.entries()));
  }, [timelineData]);

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

  // Summoner's Rift coordinate bounds
  // Min position: { x: -120, y: -120 }
  // Max position: { x: 14,870, y: 14,980 }
  const mapMinX = -120;
  const mapMaxX = 14870;
  const mapMinY = -120;
  const mapMaxY = 14980;
  const mapWidth = mapMaxX - mapMinX;
  const mapHeight = mapMaxY - mapMinY;

  // Convert percentage position to game coordinates
  const convertPercentToGameCoords = (xPercent: number, yPercent: number) => {
    // Account for the same offsets used for champion icons
    const adjustedXPercent = xPercent;
    const adjustedYPercent = yPercent;

    // Convert percentage back to game coordinates
    // xPercent = ((x - mapMinX) / mapWidth) * 100
    // So: x = (xPercent / 100) * mapWidth + mapMinX
    const gameX = (adjustedXPercent / 100) * mapWidth + mapMinX;
    // yPercent = 100 - ((y - mapMinY) / mapHeight) * 100
    // So: y = mapMinY + mapHeight - (yPercent / 100) * mapHeight
    const gameY = mapMinY + mapHeight - (adjustedYPercent / 100) * mapHeight;

    return { x: Math.round(gameX), y: Math.round(gameY) };
  };



  // Format time for display
  const formatTime = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60000);
    const seconds = Math.floor((timestamp % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Console log champion positions on frame change
  useEffect(() => {
    if (championPositions.length > 0) {
      // console.log(`\n=== Frame ${currentFrame + 1} / ${totalFrames} ===`);
      // console.log(`Timestamp: ${frame ? formatTime(frame.timestamp) : "N/A"}`);
      // console.log(`Champion Positions (${championPositions.length}):`);
      championPositions.forEach((pos) => {
        const normalizedX = (pos.x - mapMinX) / mapWidth;
        const normalizedY = 1 - (pos.y - mapMinY) / mapHeight;
        const xPercent = normalizedX * 100;
        const yPercent = normalizedY * 100;
        // console.log(
        //   `  ${pos.championName} (ID: ${pos.participantId}): ` +
        //     `game(${pos.x}, ${pos.y}) → screen(${xPercent.toFixed(2)}%, ${yPercent.toFixed(2)}%) ` +
        //     `${pos.isDead ? "[DEAD]" : "[ALIVE]"}`
        // );
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

      {/* Map with Champion Positions - Hidden for ARAM */}
      {matchData.info.queueId !== 450 && (
        <div
          ref={mapContainerRef}
          className="relative w-full bg-[#0a1428] rounded-lg overflow-hidden"
        >
        <Image
          src="/Base.png"
          alt="League of Legends Map"
          width={1920}
          height={1080}
          className="w-full h-auto object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1920px"
          priority={true}
        />
        {/* Overlay Champion Icons */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {championPositions.map((pos) => {
            // Convert game coordinates to percentage positions on the map
            // Game coordinate system: (0, 0) is bottom-left, Y increases upward
            // CSS coordinate system: (0, 0) is top-left, Y increases downward
            // So we need to invert the Y-axis

            // Normalize X coordinate: map from [mapMinX, mapMaxX] to [0, 1]
            const normalizedX = (pos.x - mapMinX) / mapWidth;
            // Normalize Y coordinate and invert: map from [mapMinY, mapMaxY] to [1, 0]
            const normalizedY = 1 - (pos.y - mapMinY) / mapHeight;

            // Convert to percentage
            const xPercent = normalizedX * 100;
            const yPercent = normalizedY * 100;
            
            // Get participant frame data
            const participantFrame = frame?.participantFrames?.[pos.participantId];

            return (
              <div
                key={pos.participantId}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: "64px",
                  height: "64px",
                  minWidth: "64px",
                  minHeight: "64px",
                  zIndex: 20,
                }}
                onMouseEnter={() => setHoveredChampion(pos.participantId)}
                onMouseLeave={() => setHoveredChampion(null)}
              >
                <div
                  className={`w-full h-full rounded-full border-4 shadow-lg cursor-pointer transition-transform ${
                    pos.teamId === 100 ? "border-blue-400" : "border-red-400"
                  } ${pos.isDead ? "opacity-60" : ""} ${
                    hoveredChampion === pos.participantId ? "scale-110" : ""
                  }`}
                >
                  <Image
                    src={getChampionImageUrl(pos.championName)}
                    alt={pos.championName}
                    width={64}
                    height={64}
                    className={`w-full h-full rounded-full object-cover ${
                      pos.isDead ? "grayscale" : ""
                    }`}
                    unoptimized
                  />
                </div>
                
                {/* Hover Card */}
                {hoveredChampion === pos.participantId && participantFrame && (
                  <div
                    ref={(el) => {
                      if (el && mapContainerRef.current) {
                        // Get the map container boundaries
                        const mapRect = mapContainerRef.current.getBoundingClientRect();
                        const championRect = el.parentElement?.getBoundingClientRect();
                        const cardRect = el.getBoundingClientRect();
                        
                        if (!championRect) return;

                        // Calculate available space on each side
                        const spaceRight = mapRect.right - championRect.right;
                        const spaceLeft = championRect.left - mapRect.left;
                        const spaceTop = championRect.top - mapRect.top;
                        const spaceBottom = mapRect.bottom - championRect.bottom;

                        // Reset positions
                        el.style.left = '';
                        el.style.right = '';
                        el.style.top = '';
                        el.style.bottom = '';
                        
                        // Horizontal positioning
                        if (spaceRight < cardRect.width + 8) {
                          // Not enough space on right, try left
                          el.style.right = 'calc(100% + 8px)';
                          el.style.left = 'auto';
                        } else {
                          // Default to right side
                          el.style.left = 'calc(100% + 8px)';
                          el.style.right = 'auto';
                        }

                        // Vertical positioning
                        // Get updated card position after horizontal positioning
                        const updatedCardRect = el.getBoundingClientRect();
                        const cardHeight = updatedCardRect.height;
                        
                        if (championRect.top + cardHeight > mapRect.bottom) {
                          // Not enough space below, move up
                          const bottomSpace = mapRect.bottom - championRect.top;
                          el.style.bottom = '0px';
                          el.style.top = 'auto';
                        } else if (championRect.top - cardHeight < mapRect.top) {
                          // Not enough space above, move down
                          el.style.top = '0px';
                          el.style.bottom = 'auto';
                        } else {
                          // Center vertically
                          el.style.top = '50%';
                          el.style.transform = 'translateY(-50%)';
                        }
                      }
                    }}
                    className="absolute bg-[#1a2332] rounded p-2 border border-[#2a3a4a] shadow-xl z-50 w-[140px]"
                  >
                    {/* Health Bar */}
                    <div className="mb-1">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{
                            width: `${((participantFrame.championStats?.health || 0) / (participantFrame.championStats?.healthMax || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Mana Bar */}
                    <div className="mb-1.5">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{
                            width: `${((participantFrame.championStats?.power || 0) / (participantFrame.championStats?.powerMax || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Gold */}
                    <div className="text-[9px] text-yellow-400 mb-1.5">
                      💰 {participantFrame.currentGold || 0}g
                    </div>
                    
                    {/* Items */}
                    <div className="flex items-center gap-0.5">
                      {(() => {
                        // Get participant data from match data for final items
                        const participant = matchData.info.participants[pos.participantId - 1];
                        const rawItems = [
                          participant?.item0 || 0,
                          participant?.item1 || 0,
                          participant?.item2 || 0,
                          participant?.item3 || 0,
                          participant?.item4 || 0,
                          participant?.item5 || 0,
                        ];
                        const trinket = participant?.item6 || 0;
                        
                        // Filter out empty slots and add them back at the end
                        const filledItems = rawItems.filter(item => item > 0);
                        const emptySlots = 6 - filledItems.length;
                        const sortedItems = [...filledItems, ...Array(emptySlots).fill(0), trinket];
                        
                        return sortedItems.map((itemId, slot) => {
                          return itemId > 0 ? (
                          <div
                            key={slot}
                            className="relative w-4 h-4 bg-[#0a0e14] rounded border border-[#3a4a5a] flex-shrink-0"
                          >
                            <Image
                              src={getItemImageUrl(itemId)}
                              alt={`Item ${itemId}`}
                              width={16}
                              height={16}
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div
                            key={slot}
                            className="w-4 h-4 bg-[#0a0e14] rounded border border-[#2a3a4a] flex-shrink-0"
                          />
                        );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Towers */}
          {Object.entries(towerPositions).map(([towerName, tower]) => {
            const currentTimestamp = frame?.timestamp || 0;
            const destroyedAt = towerDestructions.current.get(towerName);
            
            // Debug: log tower status
            if (destroyedAt !== undefined) {
              console.log(`Tower ${towerName}: destroyed at ${destroyedAt}ms, current: ${currentTimestamp}ms`);
            }
            
            // Check if tower should be visible
            let isVisible = true;
            
            if (destroyedAt !== undefined) {
              if (tower.isNexus) {
                // Nexus towers respawn after 3 minutes (180000ms)
                const timeSinceDestruction = currentTimestamp - destroyedAt;
                isVisible = timeSinceDestruction >= 180000;
                console.log(`Nexus tower ${towerName}: time since destruction ${timeSinceDestruction}ms, visible: ${isVisible}`);
              } else {
                // Regular towers don't respawn
                isVisible = currentTimestamp < destroyedAt;
                console.log(`Regular tower ${towerName}: visible before destruction: ${isVisible}`);
              }
            }
            
            if (!isVisible) return null;
            
            // Convert game coordinates to percentage
            const normalizedX = (tower.x - mapMinX) / mapWidth;
            const normalizedY = 1 - (tower.y - mapMinY) / mapHeight;
            const xPercent = normalizedX * 100;
            const yPercent = normalizedY * 100;
            
            return (
              <div
                key={towerName}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: "48px",
                  height: "48px",
                  zIndex: 10,
                }}
              >
                <Image
                  src={tower.team === 100 ? "/blue.png" : "/red.png"}
                  alt={`${tower.team === 100 ? "Blue" : "Red"} Tower`}
                  width={160}
                  height={160}
                  className="object-contain"
                  unoptimized
                />
              </div>
            );
          })}


        </div>
      </div>
      )}
    </div>
  );
}

// REMOVED: MatchChatbot component
// The global AI chat is now available via Command+Space (see GlobalAIChat component in layout)

interface PlayerRowProps {
  player: any;
  matchData: MatchData;
  region: string;
  summonerSpellCache: Map<number, { image: { full: string } }> | null;
  runeCache: Map<number, { icon: string }> | null;
  runeStyleCache: Map<number, { icon: string }> | null;
  isSelected?: boolean;
  onClick?: () => void;
}

function PlayerRow({
  player,
  matchData,
  region,
  summonerSpellCache,
  runeCache,
  runeStyleCache,
  isSelected = false,
  onClick,
}: PlayerRowProps) {
  // Get rank label
  const getRankLabel = (rank: number) => {
    if (rank === 1) return "MVP";
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
  const damagePerMin = Math.round(damageDealt / (matchData.info.gameDuration / 60));
  
  // Calculate max damage for bar chart normalization
  const maxDamage = Math.max(
    ...matchData.info.participants.map(p => p.totalDamageDealtToChampions || 0)
  );
  const damageBarPercent = maxDamage > 0 ? (damageDealt / maxDamage) * 100 : 0;

  // Calculate vision score per minute
  const visionScore = player.visionScore || 0;
  const visionPerMin = (
    visionScore /
    (matchData.info.gameDuration / 60)
  ).toFixed(1);

  return (
    <div
      onClick={onClick}
      className={`bg-[#1e2a3a] rounded p-1.5 border transition-colors ${
        isSelected
          ? "border-blue-400 bg-[#2a4060] ring-2 ring-blue-400/50"
          : "border-[#2a3a4a] hover:bg-[#253040] cursor-pointer"
      }`}
    >
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
            {player.riotIdGameName && player.riotIdTagline ? (
              <Link
                href={`/summoner/${player.riotIdGameName}-${player.riotIdTagline}?region=${region}`}
                className="text-[10px] font-semibold text-white hover:text-blue-400 truncate block transition-colors"
              >
                {player.riotIdGameName}
              </Link>
            ) : (
              <div className="text-[10px] font-semibold text-white truncate">
                {player.riotIdGameName || player.summonerName || "Unknown"}
              </div>
            )}
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
            <div className="text-xs font-semibold text-white">{cs}</div>
            <div className="text-[8px] text-gray-400">{csPerMin}/min</div>
          </div>
        )}

        {/* Gold */}
        <div className="text-center min-w-[50px] flex-shrink-0">
          <div className="text-xs font-semibold text-white">{goldK}K</div>
          <div className="text-[8px] text-gray-400">{goldPerMin}/min</div>
        </div>

        {/* Damage Bar Chart */}
        <div className="flex items-center min-w-[180px] flex-shrink-0 gap-2 pl-6">
          <div className="flex-1">
            <div className="h-2 bg-[#1a2332] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-slate-500 via-slate-400 to-slate-300 rounded-full transition-all duration-300"
                style={{ width: `${damageBarPercent}%` }}
              />
            </div>
          </div>
          <div className="text-right min-w-[85px]">
            <div className="text-xs font-semibold text-white">
              {damageK}K <span className="text-[9px] text-gray-400">({damagePerMin}/min)</span>
            </div>
          </div>
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