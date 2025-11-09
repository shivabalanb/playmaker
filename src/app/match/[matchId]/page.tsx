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

        {/* Chatbot */}
        {matchData && <MatchChatbot matchId={matchId} />}
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

  // Draggable marker state
  const [markerPosition, setMarkerPosition] = useState({ x: 50, y: 50 }); // Start at center in percentage
  const [isDragging, setIsDragging] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

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
    const xOffset = -5;
    const yOffset = 3;
    const adjustedXPercent = xPercent - xOffset;
    const adjustedYPercent = yPercent - yOffset;

    // Convert percentage back to game coordinates
    // xPercent = ((x - mapMinX) / mapWidth) * 100
    // So: x = (xPercent / 100) * mapWidth + mapMinX
    const gameX = (adjustedXPercent / 100) * mapWidth + mapMinX;
    // yPercent = 100 - ((y - mapMinY) / mapHeight) * 100
    // So: y = mapMinY + mapHeight - (yPercent / 100) * mapHeight
    const gameY = mapMinY + mapHeight - (adjustedYPercent / 100) * mapHeight;

    return { x: Math.round(gameX), y: Math.round(gameY) };
  };

  // Handle marker drag start
  const handleMarkerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // Handle marker drag end
  const handleMarkerMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Log position when drag ends
    const gameCoords = convertPercentToGameCoords(
      markerPosition.x,
      markerPosition.y
    );
    // console.log(
    //   `\n[MARKER] Position: game(${gameCoords.x}, ${gameCoords.y}) → screen(${markerPosition.x.toFixed(2)}%, ${markerPosition.y.toFixed(2)}%)`
    // );
  };

  // Handle global mouse events for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));

      setMarkerPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Log position when drag ends
      const gameCoords = convertPercentToGameCoords(
        markerPosition.x,
        markerPosition.y
      );
      // console.log(
      //   `\n[MARKER] Position: game(${gameCoords.x}, ${gameCoords.y}) → screen(${markerPosition.x.toFixed(2)}%, ${markerPosition.y.toFixed(2)}%)`
      // );
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, markerPosition]);

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

      {/* Map with Champion Positions */}
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

            return (
              <div
                key={pos.participantId}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: "64px",
                  height: "64px",
                  minWidth: "64px",
                  minHeight: "64px",
                }}
              >
                <div
                  className={`w-full h-full rounded-full border-4 shadow-lg ${
                    pos.teamId === 100 ? "border-blue-400" : "border-red-400"
                  } ${pos.isDead ? "opacity-60" : ""}`}
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
              </div>
            );
          })}

          {/* Draggable Marker */}
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move pointer-events-auto z-10"
            style={{
              left: `${markerPosition.x}%`,
              top: `${markerPosition.y}%`,
            }}
            onMouseDown={handleMarkerMouseDown}
          >
            <div className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-lg flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-yellow-600"></div>
            </div>
            {/* Tooltip showing coordinates */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap pointer-events-none">
              {(() => {
                const gameCoords = convertPercentToGameCoords(
                  markerPosition.x,
                  markerPosition.y
                );
                return `game(${gameCoords.x}, ${gameCoords.y})`;
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MatchChatbotProps {
  matchId: string;
}

function MatchChatbot({ matchId }: MatchChatbotProps) {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();
  const puuid = searchParams.get("puuid");

  // Handle Command+Space keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Close on Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Establish WebSocket connection on mount
  useEffect(() => {
    const wsUrl = "wss://ot204y8uvd.execute-api.us-east-2.amazonaws.com/test/";

    console.log(`[WebSocket] Attempting to connect to: ${wsUrl}`);

    try {
      const ws = new WebSocket(wsUrl);

      // Set connection timeout (10 seconds)
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.error("[WebSocket] Connection timeout after 10 seconds");
          setConnectionError("Connection timeout - server may be unreachable");
          ws.close();
          setIsConnected(false);
        }
      }, 10000);

      ws.onopen = () => {
        console.log("[WebSocket] ✅ Connected successfully");
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        setIsConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        try {
          const messageText = event.data;
          console.log("[WebSocket] 📨 Received raw message:", messageText);

          // Parse the message - can be in format: < {"type": "chunk", "content": "..."} or just {"type": "chunk", "content": "..."}
          const trimmed = messageText.trim();
          let parsed;

          if (trimmed.startsWith("<")) {
            // Extract JSON part after < (handle both "< " and "<" cases)
            const jsonPart = trimmed.substring(1).trim();
            parsed = JSON.parse(jsonPart);
          } else {
            // Try parsing directly as JSON
            parsed = JSON.parse(trimmed);
          }

          console.log("[WebSocket] 📦 Parsed message:", parsed);

          // Handle different message types
          if (parsed.type === "chunk" && typeof parsed.content === "string") {
            console.log("[WebSocket] ✅ Processing chunk message");
            setMessages((prev) => {
              // Check if there's already an assistant message being streamed
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.role === "assistant") {
                // Append to existing assistant message
                return [
                  ...prev.slice(0, -1),
                  {
                    role: "assistant",
                    content: lastMessage.content + parsed.content,
                  },
                ];
              } else {
                // Create new assistant message
                return [
                  ...prev,
                  { role: "assistant", content: parsed.content },
                ];
              }
            });
            // Don't set isLoading to false yet - wait for "end" message
          } else if (parsed.type === "end") {
            console.log(
              "[WebSocket] ✅ Received end message - stopping loading"
            );
            setIsLoading(false);
          } else {
            console.log("[WebSocket] ⚠️ Unknown message type:", parsed);
          }
        } catch (error) {
          console.error("[WebSocket] ❌ Error parsing message:", error);
          console.error("[WebSocket] Raw data:", event.data);
        }
      };

      ws.onerror = () => {
        // WebSocket error events don't always have detailed info
        const readyState = ws.readyState;
        const stateNames = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
        console.error("[WebSocket] ❌ Error occurred", {
          readyState: `${readyState} (${stateNames[readyState]})`,
          url: wsUrl,
        });
        setConnectionError(
          `Connection error (state: ${stateNames[readyState]})`
        );
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        setIsConnected(false);

        // Log close code and reason if available
        const closeInfo = {
          code: event.code,
          reason: event.reason || "No reason provided",
          wasClean: event.wasClean,
        };

        if (event.code !== 1000) {
          console.error("[WebSocket] ❌ Closed unexpectedly:", closeInfo);
          setConnectionError(`Connection closed (code: ${event.code})`);
        } else {
          console.log("[WebSocket] ✅ Disconnected normally:", closeInfo);
          setConnectionError(null);
        }
      };

      wsRef.current = ws;

      return () => {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          ws.close(1000, "Component unmounting");
        }
      };
    } catch (error) {
      console.error("[WebSocket] ❌ Failed to create WebSocket:", error);
      setTimeout(() => {
        setConnectionError("Failed to create WebSocket connection");
        setIsConnected(false);
      }, 0);
    }
  }, []);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !isConnected || isLoading) return;

    const userMessage = { role: "user", content: inputMessage.trim() };

    // Add user message to UI
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    console.log(puuid, "TEST")

    // Send message to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        matchIds: [matchId],
        messages: [userMessage],
        pid: [puuid],
      };
      const payloadStr = JSON.stringify(payload);
      console.log("[WebSocket] 📤 Sending message:", payloadStr);
      wsRef.current.send(payloadStr);
    } else {
      console.error(
        "[WebSocket] ❌ Cannot send - WebSocket not open. State:",
        wsRef.current?.readyState
      );
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="text-sm">Ask AI</span>
        <kbd className="px-1.5 py-0.5 text-xs bg-blue-800 rounded">⌘Space</kbd>
      </button>
    </div>
  );
}

return (
  <>
    {/* Modal - No backdrop, page remains interactable */}
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] pointer-events-none">
      <div 
        className="w-full max-w-2xl mx-4 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200"
      >
        <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden overflow-x-hidden">
          {/* Header */}
          <div className="bg-gray-800/50 px-6 py-3 border-b border-gray-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-white text-sm font-medium">Match Analysis AI</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isConnected
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}>
                {isConnected ? "Connected" : "Connecting..."}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages - Dynamic height */}
          <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-12">
                <div className="mb-2">💬</div>
                <div>Ask questions about this match</div>
                <div className="text-xs text-gray-500 mt-2">
                  Try: &quot;What happened in the early game?&quot;
                </div>
              </div>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-gray-800 text-gray-100 shadow-md"
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-gray-100 rounded-xl px-4 py-3 shadow-md">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-700/50 bg-gray-800/30">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about this match..."
                disabled={!isConnected || isLoading}
                className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500 transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={!isConnected || isLoading || !inputMessage.trim()}
                className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg hover:shadow-xl disabled:shadow-none flex items-center gap-2"
              >
                <span>Send</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
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
