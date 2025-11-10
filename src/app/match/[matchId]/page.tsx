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
import { useWebSocket } from "@/contexts/WebSocketContext";

// Cache for summoner spells and runes
let summonerSpellCache: Map<number, { image: { full: string } }> | null = null;
let runeCache: Map<number, { icon: string }> | null = null;
let runeStyleCache: Map<number, { icon: string }> | null = null;

export default function MatchDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const region = searchParams.get("region") || "americas";
  const puuid = searchParams.get("puuid");
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedPlayerPuuid, setSelectedPlayerPuuid] = useState<string | null>(
    puuid || null
  );
  const [highlightedParticipants, setHighlightedParticipants] = useState<number[]>([]);
  const [highlightedBuilding, setHighlightedBuilding] = useState<{ name: string; type: 'flash-out' | 'flash-in-out' } | null>(null);
  const [highlightedMonster, setHighlightedMonster] = useState<{ position: { x: number; y: number }; monsterType: string; teamId: number } | null>(null);
  
  // Story generation state
  const [showStoryPopup, setShowStoryPopup] = useState(false);
  const [storyContent, setStoryContent] = useState("");
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const storyContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Get ingestion status from WebSocket context
  const { isIngesting, ingestionStatus } = useWebSocket();

  // Fetch summoner spells and runes data
  useEffect(() => {
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

    fetch(`/api/riot/match?matchId=${matchId}&region=${region}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setIsLoading(false);
          return;
        }
        setMatchData(data);

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

  // Fetch match analysis
  useEffect(() => {
    if (!matchData || !puuid) return;

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
        }
      } catch (err) {
        console.error("Error fetching match analysis:", err);
      } finally {
        setIsLoadingAnalysis(false);
      }
    };

    fetchMatchAnalysis();
  }, [matchData, matchId, region, puuid]);

  // Story generation function - no retry logic
  const generateStory = () => {
    if (!puuid || !matchId || storyContent) return; // Don't regenerate if story already exists
    
    // Prevent multiple simultaneous requests
    if (wsRef.current) {
      console.log('[Story] WebSocket already exists, skipping');
      return;
    }
    
    setIsGeneratingStory(true);

    // Connect to websocket
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT || 'wss://ot204y8uvd.execute-api.us-east-2.amazonaws.com/test/');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Story] WebSocket connected');
      ws.send(JSON.stringify({
        match_id: matchId,
        puuid: puuid,
        action: "generateStory"
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chunk" && data.content) {
          setStoryContent(prev => prev + data.content);
        } else if (data.type === "complete") {
          setIsGeneratingStory(false);
          ws.close();
          wsRef.current = null;
        } else if (data.type === "error") {
          console.error('[Story] Error:', data.message);
          setIsGeneratingStory(false);
          ws.close();
          wsRef.current = null;
        }
      } catch (err) {
        console.error('[Story] Failed to parse message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('[Story] WebSocket error:', error);
      setIsGeneratingStory(false);
      ws.close();
      wsRef.current = null;
    };

    ws.onclose = (event) => {
      console.log('[Story] WebSocket closed', event.code, event.reason);
      setIsGeneratingStory(false);
      wsRef.current = null;
    };
  };

  // Auto-generate story if review=true in URL AND ingestion is complete
  useEffect(() => {
    const shouldReview = searchParams.get("review") === "true";
    const ingestionComplete = !isIngesting && (ingestionStatus === 'COMPLETE' || ingestionStatus === null);
    
    if (shouldReview && puuid && matchId && !storyContent && !isGeneratingStory && ingestionComplete) {
      setShowStoryPopup(true);
      generateStory();
    }
  }, [searchParams, puuid, matchId, isIngesting, ingestionStatus]);

  // Keyboard navigation for frames
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!timelineData?.info?.frames) return;
      
      const maxFrame = timelineData.info.frames.length - 1;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentFrame(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentFrame(prev => Math.min(maxFrame, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timelineData]);

  // Auto-scroll as story content updates
  useEffect(() => {
    if (isGeneratingStory && storyContainerRef.current) {
      const container = storyContainerRef.current;
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  }, [storyContent, isGeneratingStory]);

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

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

  allPlayerScores.sort((a, b) => a.rank - b.rank);

  const roleOrder: { [key: string]: number } = {
    TOP: 1,
    JUNGLE: 2,
    MIDDLE: 3,
    BOTTOM: 4,
    UTILITY: 5,
  };

  const sortPlayersByRole = (players: any[]) => {
    return [...players].sort((a, b) => {
      const roleA = a.teamPosition || "";
      const roleB = b.teamPosition || "";
      return (roleOrder[roleA] || 99) - (roleOrder[roleB] || 99);
    });
  };

  const team100Won = team100[0]?.win || false;
  const team200Won = team200[0]?.win || false;

  // Get team objectives
  const team100Objectives = matchData.info.teams?.find((t) => t.teamId === 100)?.objectives;
  const team200Objectives = matchData.info.teams?.find((t) => t.teamId === 200)?.objectives;

  // Get the player info for back button
  const currentPlayer = puuid ? matchData.info.participants.find((p) => p.puuid === puuid) : null;
  const backUrl = currentPlayer && currentPlayer.riotIdGameName && currentPlayer.riotIdTagline
    ? `/summoner/${currentPlayer.riotIdGameName}-${currentPlayer.riotIdTagline}?puuid=${puuid}&region=${region}`
    : "/";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Blur */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/yas.jpg"
          alt="Background"
          fill
          className="object-cover"
          style={{ filter: 'blur(1px)' }}
          priority
          quality={75}
          sizes="100vw"
        />
      </div>
      {/* Dark Overlay */}
      <div className="fixed inset-0 z-[1] bg-black/70" />
      
      {/* Content Container */}
      <div className="relative z-10">
      {/* Back Button */}
      <Link
        href={backUrl}
        className="fixed top-4 left-4 w-10 h-10 rounded-full bg-black/80 hover:bg-black flex items-center justify-center transition-colors border border-[#2a3544]/50 z-50"
        aria-label="Back to Summoner"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      {/* View Story Button */}
      {puuid && (
        <button
          onClick={() => {
            const ingestionComplete = !isIngesting && (ingestionStatus === 'COMPLETE' || ingestionStatus === null);
            if (!ingestionComplete) return;
            
            setShowStoryPopup(true);
            if (!storyContent && !isGeneratingStory) {
              generateStory();
            }
          }}
          disabled={isIngesting || (isGeneratingStory && !storyContent)}
          className="fixed top-4 left-16 px-4 h-10 rounded-full bg-blue-600/80 hover:bg-blue-600 disabled:bg-gray-600/50 disabled:cursor-not-allowed flex items-center justify-center transition-colors border border-blue-500/50 z-50 text-white text-sm font-semibold"
          aria-label="View Match Story"
          title={isIngesting ? "Processing match data..." : "View Match Story"}
        >
          {isIngesting ? (
            <>
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : isGeneratingStory && !storyContent ? (
            "Generating..."
          ) : (
            "View Story"
          )}
        </button>
      )}

      {/* Header with Logo */}
      <header className="pt-8 pb-6">
        <div className="container mx-auto px-4 text-center">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <h1 className="text-4xl font-bold text-white mb-1 tracking-tight">
              PLAYMAKER
            </h1>
            <p className="text-gray-400 text-xs tracking-wider">
              LEAGUE OF LEGENDS STATS
            </p>
          </Link>
        </div>
      </header>

      {/* Main Content - Side by Side Layout */}
      <div className="container mx-auto max-w-[1600px] px-2 py-4 ml-20">
        <div className="flex gap-6 items-start">
          {/* Left Side - Scoreboard */}
          <div className="flex-1 min-w-0 max-w-[835px]">
            {/* Team 100 (Blue Side) */}
            <div className="mb-4.5">
              {/* Team Header Row with Victory/Defeat, Game Info, and Column Labels */}
              <div className="mb-0.5">
                <div className="flex items-center gap-1.5 px-1.5 pb-0.5">
                  {/* Victory/Defeat + Game Info takes up the player info space */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-[220px] flex-shrink-0 flex items-center gap-1.5 -mt-0.5">
                      <div
                        className={`text-xs font-bold ${
                          team100Won ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {team100Won ? "Victory" : "Defeat"}
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap mt-1">
                        {getQueueType(matchData.info.queueId)}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.75">•</span>
                      <span className="text-[10px] text-gray-400 mt-1.25 whitespace-nowrap">
                        {formatDuration(matchData.info.gameDuration)}
                      </span>
                    </div>
                    <div className="w-4 flex-shrink-0"></div>
                    <div className="w-5 flex-shrink-0"></div>
                  </div>
                  

                  
                  {/* Objectives - Always reserve space */}
                  <div className="flex items-center gap-0 -ml-[80px] mt-1 w-[130px] flex-shrink-0">
                    {team100Objectives && (
                      <>
                        {team100Objectives.tower.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Towers">
                            <Image
                              src="/tower-100.png"
                              alt="Tower"
                              width={12}
                              height={12}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team100Objectives.tower.kills}</span>
                          </div>
                        )}
                        {team100Objectives.horde.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Grubs">
                            <Image
                              src="/grub-blue.png"
                              alt="Grubs"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team100Objectives.horde.kills}</span>
                          </div>
                        )}
                        {team100Objectives.riftHerald.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Rift Herald">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-100.png"
                              alt="Herald"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team100Objectives.riftHerald.kills}</span>
                          </div>
                        )}
                        {team100Objectives.dragon.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Dragons">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dragon-100.png"
                              alt="Dragon"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team100Objectives.dragon.kills}</span>
                          </div>
                        )}
                        {team100Objectives.atakhan && team100Objectives.atakhan.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Atakhan">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/vilemaw-100.png"
                              alt="Atakhan"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team100Objectives.atakhan.kills}</span>
                          </div>
                        )}
                        {team100Objectives.baron.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Baron">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-100.png"
                              alt="Baron"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team100Objectives.baron.kills}</span>
                          </div>
                        )}
                        {team100Objectives.dragon.kills >= 5 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Elder Dragon">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/elder-100.png"
                              alt="Elder Dragon"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{Math.max(0, team100Objectives.dragon.kills - 4)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                <div className="flex gap-1 mt-1">
                  <div className="text-center w-[47px] ml-3.5 flex-shrink-0 text-[9px] text-gray-500 font-semibold">KDA</div>
                  <div className="text-center w-[19px] ml-3.5 flex-shrink-0 text-[9px] text-gray-500 font-semibold">KP</div>
                  <div className="text-center w-[42px] ml-3.5 flex-shrink-0 text-[9px] text-gray-500 font-semibold">CS</div>
                  <div className="text-center w-[37px] ml-2.5 flex-shrink-0 text-[9px] text-gray-500 font-semibold">GOLD</div>
                  <div className="text-center w-[130px] ml-10 flex-shrink-0 text-[9px] text-gray-500 font-semibold">DAMAGE</div>
                  <div className="w-[51px] flex-shrink-0"></div>
                </div>
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
              {/* Team Header Row with Victory/Defeat and Column Labels */}
              <div className="mb-0.5">
                <div className="flex items-center gap-1.5 px-1.5 pb-0.5">
                  {/* Victory/Defeat takes up the player info space */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-[220px] flex-shrink-0 -mt-0.5">
                      <div
                        className={`text-xs font-bold ${
                          team200Won ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {team200Won ? "Victory" : "Defeat"}
                      </div>
                    </div>
                    <div className="w-4 flex-shrink-0"></div>
                    <div className="w-5 flex-shrink-0"></div>
                  </div>
                  

                  
                  {/* Objectives - Always reserve space */}
                  <div className="flex items-center gap-0 -ml-[80px] mt-1 w-[130px] flex-shrink-0">
                    {team200Objectives && (
                      <>
                        {team200Objectives.tower.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Towers">
                            <Image
                              src="/tower-200.png"
                              alt="Tower"
                              width={12}
                              height={12}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team200Objectives.tower.kills}</span>
                          </div>
                        )}
                        {team200Objectives.horde.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Grubs">
                            <Image
                              src="/grub-red.png"
                              alt="Grubs"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team200Objectives.horde.kills}</span>
                          </div>
                        )}
                        {team200Objectives.riftHerald.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Rift Herald">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-200.png"
                              alt="Herald"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team200Objectives.riftHerald.kills}</span>
                          </div>
                        )}
                        {team200Objectives.dragon.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Dragons">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dragon-200.png"
                              alt="Dragon"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team200Objectives.dragon.kills}</span>
                          </div>
                        )}
                        {team200Objectives.atakhan && team200Objectives.atakhan.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Atakhan">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/vilemaw-200.png"
                              alt="Atakhan"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team200Objectives.atakhan.kills}</span>
                          </div>
                        )}
                        {team200Objectives.baron.kills > 0 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Baron">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-200.png"
                              alt="Baron"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{team200Objectives.baron.kills}</span>
                          </div>
                        )}
                        {team200Objectives.dragon.kills >= 5 && (
                          <div className="flex items-center gap-0 group relative mr-0.5" title="Elder Dragon">
                            <Image
                              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/elder-200.png"
                              alt="Elder Dragon"
                              width={14}
                              height={14}
                              className="object-contain"
                              unoptimized
                            />
                            <span className="text-[9px] text-gray-300 font-semibold">{Math.max(0, team200Objectives.dragon.kills - 4)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Stats Column Labels */}
                <div className="flex gap-1 mt-1">
                  <div className="text-center w-[47px] ml-3.5 flex-shrink-0 text-[9px] text-gray-500 font-semibold">KDA</div>
                  <div className="text-center w-[19px] ml-3.5 flex-shrink-0 text-[9px] text-gray-500 font-semibold">KP</div>
                  <div className="text-center w-[42px] ml-3.5 flex-shrink-0 text-[9px] text-gray-500 font-semibold">CS</div>
                  <div className="text-center w-[37px] ml-2.5 flex-shrink-0 text-[9px] text-gray-500 font-semibold">GOLD</div>
                  <div className="text-center w-[130px] flex-shrink-0 text-[9px] text-gray-500 ml-10 font-semibold">DAMAGE</div>
                  <div className="w-[51px] flex-shrink-0">
                </div>

                  </div>
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

            {/* Player Purchase Timeline - Now under scoreboard */}
            {selectedPlayerPuuid && timelineData && matchData && (
              <div className="mt-2">
                <PlayerPurchaseTimeline
                  selectedPlayerPuuid={selectedPlayerPuuid}
                  timelineData={timelineData}
                  matchData={matchData}
                />
              </div>
            )}
          </div>

          {/* Right Side - Map Timeline and Event Timeline */}
          {timelineData && matchData && matchData.info.queueId !== 450 && (
            <div className="w-[480px] flex-shrink-0 mt-4 space-y-4">
              <MapTimeline
                timelineData={timelineData}
                matchData={matchData}
                currentFrame={currentFrame}
                setCurrentFrame={setCurrentFrame}
                highlightedParticipants={highlightedParticipants}
                highlightedBuilding={highlightedBuilding}
                highlightedMonster={highlightedMonster}
              />
              
              {/* Event Timeline */}
              <EventTimeline
                timelineData={timelineData}
                matchData={matchData}
                setCurrentFrame={setCurrentFrame}
                setHighlightedParticipants={setHighlightedParticipants}
                setHighlightedBuilding={setHighlightedBuilding}
                setHighlightedMonster={setHighlightedMonster}
                onEventClick={(position) => {
                  // TODO: Highlight position on map
                  console.log('Event position:', position);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Story Popup */}
      {showStoryPopup && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowStoryPopup(false)}
        >
          <div 
            ref={storyContainerRef}
            className="relative bg-transparent rounded-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto story-scroll"
            onClick={(e) => e.stopPropagation()}
          >
            <style jsx>{`
              .story-scroll::-webkit-scrollbar {
                width: 8px;
              }
              .story-scroll::-webkit-scrollbar-track {
                background: transparent;
              }
              .story-scroll::-webkit-scrollbar-thumb {
                background: #1e3a8a;
                border-radius: 4px;
              }
              .story-scroll::-webkit-scrollbar-thumb:hover {
                background: #1e40af;
              }
              .story-scroll {
                scrollbar-width: thin;
                scrollbar-color: #1e3a8a transparent;
              }
            `}</style>

            {/* Close button */}
            <button
              onClick={() => setShowStoryPopup(false)}
              className="absolute top-2 right-2 p-2 hover:opacity-70 transition-opacity z-10"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Story content */}
            <div className="px-6 pb-6">
              {storyContent ? (
                <div className="text-gray-200 whitespace-pre-wrap leading-relaxed text-lg">
                  {storyContent}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Generating your match story...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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
  const selectedPlayer = matchData.info.participants.find(
    (p) => p.puuid === selectedPlayerPuuid
  );

  if (!selectedPlayer) return null;

  const participantId =
    matchData.info.participants.findIndex((p) => p.puuid === selectedPlayerPuuid) + 1;

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
                itemId: event.beforeId,
                participantId: event.participantId,
                type: 'UNDO'
              });
            }
          }
        });
      }
    });
  }

  const finalPurchases: Array<{ timestamp: number; itemId: number; participantId: number }> = [];
  const eventStack: Array<{
    type: 'PURCHASE' | 'SELL';
    timestamp: number;
    itemId: number;
    participantId: number;
  }> = [];

  itemEvents.forEach((event) => {
    if (event.type === 'PURCHASE') {
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
      const lastEventIndex = [...eventStack].reverse().findIndex(e => e.participantId === event.participantId);
      if (lastEventIndex !== -1) {
        const actualIndex = eventStack.length - 1 - lastEventIndex;
        const lastEvent = eventStack[actualIndex];
        
        eventStack.splice(actualIndex, 1);
        
        if (lastEvent.type === 'PURCHASE') {
          const purchaseIndex = finalPurchases.findIndex(p => 
            p.timestamp === lastEvent.timestamp && p.itemId === lastEvent.itemId
          );
          if (purchaseIndex !== -1) {
            finalPurchases.splice(purchaseIndex, 1);
          }
        } else if (lastEvent.type === 'SELL') {
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

  const groupedPurchases: Array<{ timestamp: number; items: number[] }> = [];

  finalPurchases
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach((purchase) => {
      const lastGroup = groupedPurchases[groupedPurchases.length - 1];

      if (!lastGroup || purchase.timestamp - lastGroup.timestamp > 5000) {
        groupedPurchases.push({
          timestamp: purchase.timestamp,
          items: [purchase.itemId],
        });
      } else {
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
  <div className="bg-[#1a2332] rounded-lg p-2 border border-[#2a3a4a]">


    {groupedPurchases.length === 0 ? (
      <p className="text-xs text-gray-400">No purchases recorded</p>
    ) : (
      <div className="flex items-center gap-y-2 gap-x-0 flex-wrap">
        {groupedPurchases.map((group, idx) => (
          <div key={idx} className="flex items-center gap-0">
            <div className="flex items-center gap-1.5 bg-[#0f1821] p-1.5 rounded">
              <div className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                {formatTime(group.timestamp)}
              </div>
              <div className="flex items-center gap-0.5">
                {group.items.map((itemId, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="relative w-6 h-6 bg-[#0a0e14] rounded border border-[#3a4a5a] flex-shrink-0"
                  >
                    <Image
                      src={getItemImageUrl(itemId)}
                      alt={`Item ${itemId}`}
                      width={24}
                      height={24}
                      className="object-cover rounded"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
            {idx < groupedPurchases.length - 1 && (
              <div className="w-6 h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent flex-shrink-0" />
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
  highlightedParticipants: number[];
  highlightedBuilding: { name: string; type: 'flash-out' | 'flash-in-out' } | null;
  highlightedMonster: { position: { x: number; y: number }; monsterType: string; teamId: number } | null;
}

function MapTimeline({
  timelineData,
  matchData,
  currentFrame,
  setCurrentFrame,
  highlightedParticipants,
  highlightedBuilding,
  highlightedMonster,
}: MapTimelineProps) {
  const frames = timelineData?.info?.frames || [];
  const totalFrames = frames.length;
  const frame = frames[currentFrame] || null;

  const [hoveredChampion, setHoveredChampion] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle play/pause functionality
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        if (currentFrame >= totalFrames - 1) {
          setIsPlaying(false);
        } else {
          setCurrentFrame(currentFrame + 1);
        }
      }, 1000); // Advance frame every 1 second
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, currentFrame, totalFrames, setCurrentFrame]);

  const towerPositions = {
    BLUE_TOP_LANE_OUTER_TURRET: { x: 981, y: 11141, team: 100, isNexus: false },
    BLUE_TOP_LANE_INNER_TURRET: { x: 1512, y: 7399, team: 100, isNexus: false },
    BLUE_TOP_LANE_BASE_TURRET: { x: 1169, y: 4987, team: 100, isNexus: false },
    BLUE_MID_LANE_OUTER_TURRET: { x: 5846, y: 7096, team: 100, isNexus: false },
    BLUE_MID_LANE_INNER_TURRET: { x: 5048, y: 5512, team: 100, isNexus: false },
    BLUE_MID_LANE_BASE_TURRET: { x: 3651, y: 4396, team: 100, isNexus: false },
    BLUE_BOT_LANE_OUTER_TURRET: { x: 10504, y: 1729, team: 100, isNexus: false },
    BLUE_BOT_LANE_INNER_TURRET: { x: 6919, y: 2183, team: 100, isNexus: false },
    BLUE_BOT_LANE_BASE_TURRET: { x: 4281, y: 1753, team: 100, isNexus: false },
    BLUE_TOP_LANE_NEXUS_TURRET: { x: 1748, y: 3070, team: 100, isNexus: true },
    BLUE_BOT_LANE_NEXUS_TURRET: { x: 2177, y: 2507, team: 100, isNexus: true },
    RED_TOP_LANE_OUTER_TURRET: { x: 4318, y: 14575, team: 200, isNexus: false },
    RED_TOP_LANE_INNER_TURRET: { x: 7943, y: 14111, team: 200, isNexus: false },
    RED_TOP_LANE_BASE_TURRET: { x: 10481, y: 14350, team: 200, isNexus: false },
    RED_MID_LANE_OUTER_TURRET: { x: 8955, y: 9210, team: 200, isNexus: false },
    RED_MID_LANE_INNER_TURRET: { x: 9767, y: 10813, team: 200, isNexus: false },
    RED_MID_LANE_BASE_TURRET: { x: 11134, y: 11907, team: 200, isNexus: false },
    RED_BOT_LANE_OUTER_TURRET: { x: 13866, y: 5205, team: 200, isNexus: false },
    RED_BOT_LANE_INNER_TURRET: { x: 13327, y: 8926, team: 200, isNexus: false },
    RED_BOT_LANE_BASE_TURRET: { x: 13624, y: 11272, team: 200, isNexus: false },
    RED_TOP_LANE_NEXUS_TURRET: { x: 12611, y: 13784, team: 200, isNexus: true },
    RED_BOT_LANE_NEXUS_TURRET: { x: 13052, y: 13312, team: 200, isNexus: true },
  };

  const towerDestructions = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    if (!timelineData) return;
    
    towerDestructions.current.clear();
    
    timelineData.info.frames.forEach((frame: any) => {
      if (frame.events) {
        frame.events.forEach((event: any) => {
          if (event.type === "BUILDING_KILL" && event.buildingType === "TOWER_BUILDING") {
            const teamPrefix = event.teamId === 100 ? "BLUE" : "RED";
            const laneType = event.laneType;
            const towerTier = event.towerType;
            
            const towerName = `${teamPrefix}_${laneType}_${towerTier}`;
            towerDestructions.current.set(towerName, event.timestamp);
          }
        });
      }
    });
  }, [timelineData]);

  const participantMap = new Map<number, string>();
  const participantTeamMap = new Map<number, number>();
  matchData.info.participants.forEach((p, index) => {
    participantMap.set(index + 1, p.championName);
    participantTeamMap.set(index + 1, p.teamId);
  });

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

  const mapMinX = -120;
  const mapMaxX = 14870;
  const mapMinY = -120;
  const mapMaxY = 14980;
  const mapWidth = mapMaxX - mapMinX;
  const mapHeight = mapMaxY - mapMinY;

  const formatTime = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60000);
    const seconds = Math.floor((timestamp % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate team stats for current frame
  const getTeamStatsForFrame = () => {
    if (!frame || !frame.participantFrames) {
      return { blue: { kills: 0, gold: 0 }, red: { kills: 0, gold: 0 } };
    }

    let blueKills = 0;
    let redKills = 0;
    let blueGold = 0;
    let redGold = 0;

    Object.entries(frame.participantFrames).forEach(([participantId, participantFrame]: [string, any]) => {
      const pid = parseInt(participantId);
      const participant = matchData.info.participants[pid - 1];
      
      if (participant) {
        const kills = participantFrame.championStats?.kills || 0;
        const gold = participantFrame.totalGold || 0;
        
        if (participant.teamId === 100) {
          blueKills += kills;
          blueGold += gold;
        } else {
          redKills += kills;
          redGold += gold;
        }
      }
    });

    return {
      blue: { kills: blueKills, gold: Math.round(blueGold / 1000) },
      red: { kills: redKills, gold: Math.round(redGold / 1000) }
    };
  };

  // Count objectives up to current frame
  const getObjectivesForFrame = () => {
    const currentTimestamp = frame?.timestamp || 0;
    let blueTowers = 0, blueDragons = 0, blueElders = 0, blueBarons = 0, blueHeralds = 0, blueGrubs = 0, blueAtakhans = 0;
    let redTowers = 0, redDragons = 0, redElders = 0, redBarons = 0, redHeralds = 0, redGrubs = 0, redAtakhans = 0;

    if (timelineData?.info?.frames) {
      timelineData.info.frames.forEach((f: any) => {
        if (f.timestamp > currentTimestamp) return;
        
        f.events?.forEach((event: any) => {
          if (event.type === "BUILDING_KILL" && event.buildingType === "TOWER_BUILDING") {
            // Count towers destroyed by the enemy team (teamId is the team that LOST the tower)
            if (event.teamId === 100) redTowers++; // Blue team's tower destroyed = red team gets credit
            else if (event.teamId === 200) blueTowers++; // Red team's tower destroyed = blue team gets credit
          }
          else if (event.type === "ELITE_MONSTER_KILL") {
            if (event.killerTeamId === 100) {
              if (event.monsterType === "DRAGON") {
                if (event.monsterSubType === "ELDER_DRAGON") blueElders++;
                else blueDragons++;
              }
              else if (event.monsterType === "BARON_NASHOR") blueBarons++;
              else if (event.monsterType === "RIFTHERALD") blueHeralds++;
              else if (event.monsterType === "HORDE") blueGrubs++;
              else if (event.monsterType === "ATAKHAN") blueAtakhans++;
            } else if (event.killerTeamId === 200) {
              if (event.monsterType === "DRAGON") {
                if (event.monsterSubType === "ELDER_DRAGON") redElders++;
                else redDragons++;
              }
              else if (event.monsterType === "BARON_NASHOR") redBarons++;
              else if (event.monsterType === "RIFTHERALD") redHeralds++;
              else if (event.monsterType === "HORDE") redGrubs++;
              else if (event.monsterType === "ATAKHAN") redAtakhans++;
            }
          }
        });
      });
    }

    return {
      blue: { towers: blueTowers, dragons: blueDragons, elders: blueElders, barons: blueBarons, heralds: blueHeralds, grubs: blueGrubs, atakhans: blueAtakhans },
      red: { towers: redTowers, dragons: redDragons, elders: redElders, barons: redBarons, heralds: redHeralds, grubs: redGrubs, atakhans: redAtakhans }
    };
  };

  const teamStats = getTeamStatsForFrame();
  const objectives = getObjectivesForFrame();

return (
    <div className="sticky top-2">
      {/* Team Stats Header */}
      <div className="bg-[#1a2332] rounded-xl p-3 border border-[#2a3544]/50 shadow-lg mb-2">
        <div className="flex items-center justify-between text-xs">
          {/* Blue Team */}
          <div className="flex items-center gap-4">
            {/* Blue Objectives */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <Image
                  src="/tower-100.png"
                  alt="Towers"
                  width={14}
                  height={14}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-blue-400 font-semibold">{objectives.blue.towers}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="/grub-blue.png"
                  alt="Grubs"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-blue-400 font-semibold">{objectives.blue.grubs}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-100.png"
                  alt="Herald"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-blue-400 font-semibold">{objectives.blue.heralds}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dragon-100.png"
                  alt="Dragon"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-blue-400 font-semibold">{objectives.blue.dragons}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/vilemaw-100.png"
                  alt="Atakhan"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-blue-400 font-semibold">{objectives.blue.atakhans}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-100.png"
                  alt="Baron"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-blue-400 font-semibold">{objectives.blue.barons}</span>
              </div>
              {objectives.blue.elders > 0 && (
                <div className="flex items-center gap-0.5">
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/elder-100.png"
                    alt="Elder Dragon"
                    width={16}
                    height={16}
                    className="object-contain"
                    unoptimized
                  />
                  <span className="text-blue-400 font-semibold">{objectives.blue.elders}</span>
                </div>
              )}
            </div>
            
            {/* Blue Gold */}
            <div className="flex items-center gap-1 text-yellow-400">
              <span className="font-semibold">{teamStats.blue.gold}K</span>
            </div>
            
            {/* Blue Kills */}
            <div className="flex items-center gap-1 text-blue-400">
              <span className="font-semibold">{teamStats.blue.kills}</span>
            </div>
          </div>

          {/* Kill Icon */}
          <div className="flex items-center px-2">
            <Image
              src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/kills.png"
              alt="Kills"
              width={20}
              height={20}
              className="object-contain"
              unoptimized
            />
          </div>

          {/* Red Team */}
          <div className="flex items-center gap-4">
            {/* Red Kills */}
            <div className="flex items-center gap-1 text-red-400">
              <span className="font-semibold">{teamStats.red.kills}</span>
            </div>
            
            {/* Red Gold */}
            <div className="flex items-center gap-1 text-yellow-400">
              <span className="font-semibold">{teamStats.red.gold}K</span>
            </div>
            
            {/* Red Objectives */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <Image
                  src="/tower-200.png"
                  alt="Towers"
                  width={14}
                  height={14}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-red-400 font-semibold">{objectives.red.towers}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="/grub-red.png"
                  alt="Grubs"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-red-400 font-semibold">{objectives.red.grubs}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-200.png"
                  alt="Herald"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-red-400 font-semibold">{objectives.red.heralds}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dragon-200.png"
                  alt="Dragon"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-red-400 font-semibold">{objectives.red.dragons}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/vilemaw-200.png"
                  alt="Atakhan"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-red-400 font-semibold">{objectives.red.atakhans}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Image
                  src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-200.png"
                  alt="Baron"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-red-400 font-semibold">{objectives.red.barons}</span>
              </div>
              {objectives.red.elders > 0 && (
                <div className="flex items-center gap-0.5">
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/elder-200.png"
                    alt="Elder Dragon"
                    width={16}
                    height={16}
                    className="object-contain"
                    unoptimized
                  />
                  <span className="text-red-400 font-semibold">{objectives.red.elders}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slider Controls */}
      <div className="bg-[#1a2332] rounded-xl p-3 border border-[#2a3544]/50 shadow-lg mb-2">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 flex items-center justify-center bg-[#0f1923] hover:bg-[#1a2332] rounded-lg border border-[#2a3544]/50 transition-all text-white"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Previous Button */}
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentFrame(Math.max(0, currentFrame - 1));
            }}
            disabled={currentFrame <= 0}
            className="w-8 h-8 flex items-center justify-center bg-[#0f1923] hover:bg-[#1a2332] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#0f1923] rounded-lg border border-[#2a3544]/50 transition-all text-white"
            aria-label="Previous frame"
          >
            <svg
              className="w-4 h-4"
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
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentFrame(parseInt(e.target.value));
              }}
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
            onClick={() => {
              setIsPlaying(false);
              setCurrentFrame(Math.min(totalFrames - 1, currentFrame + 1));
            }}
            disabled={currentFrame >= totalFrames - 1}
            className="w-8 h-8 flex items-center justify-center bg-[#0f1923] hover:bg-[#1a2332] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#0f1923] rounded-lg border border-[#2a3544]/50 transition-all text-white"
            aria-label="Next frame"
          >
            <svg
              className="w-4 h-4"
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
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="text-xs font-semibold text-white">
              {currentFrame + 1} / {totalFrames}
            </div>
            {frame && (
              <div className="text-xs text-gray-400 mt-0.5 ml-3 font-mono">
                {formatTime(frame.timestamp)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map with Champion Positions */}
      <div ref={mapContainerRef} className="relative w-full bg-[#0a1428] rounded-lg overflow-hidden" >
        <style jsx>{`
          @keyframes goldPulseBlue {
            0% {
              box-shadow: 0 0 0px rgba(250, 204, 21, 0);
              border-color: rgb(96, 165, 250);
            }
            50% {
              box-shadow: 0 0 25px rgba(250, 204, 21, 1);
              border-color: rgb(250, 204, 21);
            }
            100% {
              box-shadow: 0 0 0px rgba(250, 204, 21, 0);
              border-color: rgb(96, 165, 250);
            }
          }
          @keyframes goldPulseRed {
            0% {
              box-shadow: 0 0 0px rgba(250, 204, 21, 0);
              border-color: rgb(248, 113, 113);
            }
            50% {
              box-shadow: 0 0 25px rgba(250, 204, 21, 1);
              border-color: rgb(250, 204, 21);
            }
            100% {
              box-shadow: 0 0 0px rgba(250, 204, 21, 0);
              border-color: rgb(248, 113, 113);
            }
          }
          @keyframes goldGlowPulse {
            0% {
              filter: drop-shadow(0 0 0px rgba(250, 204, 21, 0));
            }
            50% {
              filter: drop-shadow(0 0 15px rgba(250, 204, 21, 1)) brightness(1.3);
            }
            100% {
              filter: drop-shadow(0 0 0px rgba(250, 204, 21, 0));
            }
          }
          @keyframes fadeInGoldPulseOut {
            0% {
              opacity: 0;
              filter: drop-shadow(0 0 0px rgba(250, 204, 21, 0));
            }
            15% {
              opacity: 1;
              filter: drop-shadow(0 0 0px rgba(250, 204, 21, 0));
            }
            50% {
              opacity: 1;
              filter: drop-shadow(0 0 20px rgba(250, 204, 21, 1)) brightness(1.4);
            }
            85% {
              opacity: 1;
              filter: drop-shadow(0 0 0px rgba(250, 204, 21, 0));
            }
            100% {
              opacity: 0;
              filter: drop-shadow(0 0 0px rgba(250, 204, 21, 0));
            }
          }
          .gold-pulse-animation-blue {
            animation: goldPulseBlue 2s ease-in-out;
          }
          .gold-pulse-animation-red {
            animation: goldPulseRed 2s ease-in-out;
          }
          .gold-glow-pulse {
            animation: goldGlowPulse 1s ease-in-out;
          }
          .fade-in-gold-pulse-out {
            animation: fadeInGoldPulseOut 2s ease-in-out;
          }
        `}</style>
        <Image
          src="/Base.png"
          alt="League of Legends Map"
          width={600}
          height={600}
          className="w-full h-auto object-contain"
          priority={true}
        />
        {/* Overlay Champion Icons */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {championPositions.map((pos) => {
            const normalizedX = (pos.x - mapMinX) / mapWidth;
            const normalizedY = 1 - (pos.y - mapMinY) / mapHeight;

            const xPercent = normalizedX * 100;
            const yPercent = normalizedY * 100;

            return (
              <div
                key={pos.participantId}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: "36px",
                  height: "36px",
                  minWidth: "36px",
                  minHeight: "36px",
                  zIndex: 20,
                }}
                onMouseEnter={() => setHoveredChampion(pos.participantId)}
                onMouseLeave={() => setHoveredChampion(null)}
              >
                <div
                  className={`w-full h-full rounded-full border-3 shadow-lg cursor-pointer transition-transform ${
                    highlightedParticipants.includes(pos.participantId)
                      ? pos.teamId === 100 
                        ? "gold-pulse-animation-blue" 
                        : "gold-pulse-animation-red"
                      : ""
                  } ${
                    pos.teamId === 100 ? "border-blue-400" : "border-red-400"
                  } ${pos.isDead ? "opacity-60" : ""} ${
                    hoveredChampion === pos.participantId ? "scale-110" : ""
                  }`}
                >
                  <Image
                    src={getChampionImageUrl(pos.championName)}
                    alt={pos.championName}
                    width={48}
                    height={48}
                    className={`w-full h-full rounded-full object-cover ${
                      pos.isDead ? "grayscale" : ""
                    }`}
                    unoptimized
                  />
                </div>
              </div>
            );
          })}
          
          {/* Hover Card - Rendered separately with highest z-index */}
          {hoveredChampion !== null && (() => {
            const hoveredPos = championPositions.find(p => p.participantId === hoveredChampion);
            const participantFrame = frame?.participantFrames?.[hoveredChampion];
            
            if (!hoveredPos || !participantFrame) return null;
            
            const normalizedX = (hoveredPos.x - mapMinX) / mapWidth;
            const normalizedY = 1 - (hoveredPos.y - mapMinY) / mapHeight;
            const xPercent = normalizedX * 100;
            const yPercent = normalizedY * 100;
            
            return (
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: "36px",
                  height: "36px",
                  zIndex: 100,
                }}
              >
                <div
                  ref={(el) => {
                    if (el && mapContainerRef.current) {
                      const mapRect = mapContainerRef.current.getBoundingClientRect();
                      const cardRect = el.getBoundingClientRect();
                      
                      const championX = (xPercent / 100) * mapRect.width;
                      const championY = (yPercent / 100) * mapRect.height;

                      el.style.left = '';
                      el.style.right = '';
                      el.style.top = '';
                      el.style.bottom = '';
                      
                      const spaceRight = mapRect.width - championX;
                      
                      if (spaceRight < cardRect.width + 26) {
                        el.style.right = 'calc(100% + 8px)';
                        el.style.left = 'auto';
                      } else {
                        el.style.left = 'calc(100% + 8px)';
                        el.style.right = 'auto';
                      }

                      const updatedCardRect = el.getBoundingClientRect();
                      const cardHeight = updatedCardRect.height;
                      
                      if (championY + cardHeight > mapRect.height) {
                        el.style.bottom = '0px';
                        el.style.top = 'auto';
                      } else if (championY - cardHeight < 0) {
                        el.style.top = '0px';
                        el.style.bottom = 'auto';
                      } else {
                        el.style.top = '50%';
                        el.style.transform = 'translateY(-50%)';
                      }
                    }
                  }}
                  className="absolute bg-[#1a2332] rounded p-2 border border-[#2a3a4a] shadow-xl w-[140px] pointer-events-auto"
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
                      const participant = matchData.info.participants[hoveredPos.participantId - 1];
                      const rawItems = [
                        participant?.item0 || 0,
                        participant?.item1 || 0,
                        participant?.item2 || 0,
                        participant?.item3 || 0,
                        participant?.item4 || 0,
                        participant?.item5 || 0,
                      ];
                      const trinket = participant?.item6 || 0;
                      
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
              </div>
            );
          })()}

          {/* Towers */}
          {Object.entries(towerPositions).map(([towerName, tower]) => {
            const currentTimestamp = frame?.timestamp || 0;
            const destroyedAt = towerDestructions.current.get(towerName);
            
            let isVisible = true;
            
            if (destroyedAt !== undefined) {
              if (tower.isNexus) {
                const timeSinceDestruction = currentTimestamp - destroyedAt;
                isVisible = timeSinceDestruction >= 180000;
              } else {
                isVisible = currentTimestamp < destroyedAt;
              }
            }
            
            if (!isVisible) return null;
            
            const normalizedX = (tower.x - mapMinX) / mapWidth;
            const normalizedY = 1 - (tower.y - mapMinY) / mapHeight;
            const xPercent = normalizedX * 100;
            const yPercent = normalizedY * 100;
            
            const isHighlighted = highlightedBuilding?.name === towerName;
            const animationType = highlightedBuilding?.type;
            
            return (
              <div
                key={towerName}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                  isHighlighted ? 'gold-glow-pulse' : ''
                }`}
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: "36px",
                  height: "36px",
                  zIndex: 10,
                }}
              >
                <Image
                  src={tower.team === 100 ? "/blue.png" : "/red.png"}
                  alt={`${tower.team === 100 ? "Blue" : "Red"} Tower`}
                  width={40}
                  height={40}
                  className="object-contain"
                  unoptimized
                />
              </div>
            );
          })}

          {/* Highlighted Destroyed Tower */}
          {highlightedBuilding && (() => {
            const tower = towerPositions[highlightedBuilding.name as keyof typeof towerPositions];
            if (!tower) return null;
            
            const normalizedX = (tower.x - mapMinX) / mapWidth;
            const normalizedY = 1 - (tower.y - mapMinY) / mapHeight;
            const xPercent = normalizedX * 100;
            const yPercent = normalizedY * 100;
            
            return (
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 fade-in-gold-pulse-out"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: "36px",
                  height: "36px",
                  zIndex: 25,
                }}
              >
                <Image
                  src={tower.team === 100 ? "/blue.png" : "/red.png"}
                  alt={`${tower.team === 100 ? "Blue" : "Red"} Tower`}
                  width={120}
                  height={120}
                  className="object-contain"
                  unoptimized
                />
              </div>
            );
          })()}

          {/* Highlighted Monster */}
          {highlightedMonster && (() => {
            const normalizedX = (highlightedMonster.position.x - mapMinX) / mapWidth;
            const normalizedY = 1 - (highlightedMonster.position.y - mapMinY) / mapHeight;
            const xPercent = normalizedX * 100;
            const yPercent = normalizedY * 100;
            
            return (
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 fade-in-gold-pulse-out"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  width: "32px",
                  height: "32px",
                  zIndex: 25,
                }}
              >
                {highlightedMonster.monsterType === "DRAGON" ? (
                  <Image
                    src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dragon-${highlightedMonster.teamId}.png`}
                    alt="Dragon"
                    width={32}
                    height={32}
                    className="object-contain"
                    unoptimized
                  />
                ) : highlightedMonster.monsterType === "BARON_NASHOR" ? (
                  <Image
                    src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-${highlightedMonster.teamId}.png`}
                    alt="Baron"
                    width={32}
                    height={32}
                    className="object-contain"
                    unoptimized
                  />
                ) : highlightedMonster.monsterType === "RIFTHERALD" ? (
                  <Image
                    src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-${highlightedMonster.teamId}.png`}
                    alt="Herald"
                    width={32}
                    height={32}
                    className="object-contain"
                    unoptimized
                  />
                ) : highlightedMonster.monsterType === "HORDE" ? (
                  <Image
                    src={highlightedMonster.teamId === 100 ? "/grub-blue.png" : "/grub-red.png"}
                    alt="Grubs"
                    width={32}
                    height={32}
                    className="object-contain"
                    unoptimized
                  />
                ) : highlightedMonster.monsterType === "ATAKHAN" ? (
                  <Image
                    src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/vilemaw-${highlightedMonster.teamId}.png`}
                    alt="Atakhan"
                    width={32}
                    height={32}
                    className="object-contain"
                    unoptimized
                  />
                ) : null}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

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
  const getRankLabel = (rank: number) => {
    if (rank === 1) return "MVP";
    const suffix = rank === 2 ? "nd" : rank === 3 ? "rd" : "th";
    return `${rank}${suffix}`;
  };

  const summoner1Spell = summonerSpellCache?.get(player.summoner1Id);
  const summoner2Spell = summonerSpellCache?.get(player.summoner2Id);
  const summoner1Image = summoner1Spell
    ? getSummonerSpellImageUrl(summoner1Spell.image.full)
    : null;
  const summoner2Image = summoner2Spell
    ? getSummonerSpellImageUrl(summoner2Spell.image.full)
    : null;

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

  const rawItems = [
    player.item0,
    player.item1,
    player.item2,
    player.item3,
    player.item4,
    player.item5,
  ];
  const sortedItems = [...rawItems].sort((a, b) => b - a);
  const reorderedItems = reorderItemsWithBootsFirst(sortedItems);
  const filledItems = reorderedItems.filter((item) => item > 0);
  const emptySlots = 6 - filledItems.length;
  const items = [...filledItems, ...Array(emptySlots).fill(0)];
  const trinket = player.item6;

  const kda = `${player.kills}/${player.deaths}/${player.assists}`;
  const kdaRatio =
    player.deaths > 0
      ? ((player.kills + player.assists) / player.deaths).toFixed(2)
      : "Perfect";

  const cs = player.totalMinionsKilled + player.neutralMinionsKilled;
  const csPerMin = (cs / (matchData.info.gameDuration / 60)).toFixed(1);

  const gold = player.goldEarned;
  const goldK = (gold / 1000).toFixed(1);
  const goldPerMin = (gold / (matchData.info.gameDuration / 60)).toFixed(0);

  const damageDealt = player.totalDamageDealtToChampions || 0;
  const damageK = (damageDealt / 1000).toFixed(1);
  const damagePerMin = Math.round(damageDealt / (matchData.info.gameDuration / 60));
  
  const maxDamage = Math.max(
    ...matchData.info.participants.map(p => p.totalDamageDealtToChampions || 0)
  );
  const damageBarPercent = maxDamage > 0 ? (damageDealt / maxDamage) * 100 : 0;

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
        <div className="flex items-center gap-0.5 flex-shrink-0 -ml-3">
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
            <div className="text-[8px] text-gray-400">VS/m</div>
          </div>
        ) : (
          <div className="text-center min-w-[45px] flex-shrink-0">
            <div className="text-xs font-semibold text-white">{cs}</div>
            <div className="text-[8px] text-gray-400">{csPerMin}/m</div>
          </div>
        )}

        {/* Gold */}
        <div className="text-center min-w-[50px] flex-shrink-0">
          <div className="text-xs font-semibold text-white">{goldK}K</div>
          <div className="text-[8px] text-gray-400">{goldPerMin}/m</div>
        </div>

        {/* Damage Bar Chart */}
        <div className="flex items-center min-w-[170px] flex-shrink-0 gap-1 pl-2 ml-5">
          <div className="flex-1">
            <div className="h-2 bg-[#0d111a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-slate-500 via-slate-400 to-slate-300 rounded-full transition-all duration-300"
                style={{ width: `${damageBarPercent}%` }}
              />
            </div>
          </div>
          <div className="text-right min-w-[85px]">
            <div className="text-xs font-semibold text-white">
              {damageK}K <span className="text-[9px] text-gray-400">({damagePerMin}/m)</span>
            </div>
          </div>
        </div>

        {/* Performance Score */}
        <div className="flex items-center min-w-[55px] flex-shrink-0 ml-auto -ml-4">
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

interface EventTimelineProps {
  timelineData: any;
  matchData: MatchData;
  setCurrentFrame: (frame: number) => void;
  setHighlightedParticipants: (participants: number[]) => void;
  setHighlightedBuilding: (building: { name: string; type: 'flash-out' | 'flash-in-out' } | null) => void;
  setHighlightedMonster: (monster: { position: { x: number; y: number }; monsterType: string; teamId: number } | null) => void;
  onEventClick: (position: { x: number; y: number } | null) => void;
}

function EventTimeline({ timelineData, matchData, setCurrentFrame, setHighlightedParticipants, setHighlightedBuilding, setHighlightedMonster, onEventClick }: EventTimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [highlightPosition, setHighlightPosition] = useState<{ x: number; y: number } | null>(null);

  const excludedEventTypes = [
    "ITEM_DESTROYED",
    "WARD_KILL",
    "SKILL_LEVEL_UP",
    "WARD_PLACED",
    "LEVEL_UP",
    "ITEM_PURCHASED",
    "ITEM_SOLD",
    "ITEM_UNDO",
    "PAUSE_END",
    "KILL_FIRST_BLOOD",
    "CHAMPION_SPECIAL_KILL",
    "DRAGON_SOUL_GIVEN",
    "OBJECTIVE_BOUNTY_PRESTART"
  ];

  // Filter out FEAT_UPDATE events with value 1001 and non-claimed feats
  const shouldIncludeEvent = (event: any) => {
    if (excludedEventTypes.includes(event.type)) return false;
    if (event.type === "FEAT_UPDATE") {
      // Exclude 1001 events
      if (event.featValue === 1001) return false;
      
      // Only include claimed feats
      const isClaimed = (event.featType === 0 && event.featValue === 3) || 
                       (event.featType === 1 && event.featValue === 1) || 
                       (event.featType === 2 && event.featValue === 3);
      return isClaimed;
    }
    return true;
  };

  // Collect all events from all frames
  const allEvents: any[] = [];
  if (timelineData?.info?.frames) {
    timelineData.info.frames.forEach((frame: any) => {
      if (frame.events) {
        frame.events.forEach((event: any) => {
          if (shouldIncludeEvent(event)) {
            allEvents.push(event);
          }
        });
      }
    });
  }

  const formatTime = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60000);
    const seconds = Math.floor((timestamp % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getEventIcon = (eventType: string) => {
    const iconMap: { [key: string]: string } = {
      CHAMPION_KILL: "⚔️",
      BUILDING_KILL: "🏰",
      ELITE_MONSTER_KILL: "🐉",
      TURRET_PLATE_DESTROYED: "🛡️",
      CHAMPION_SPECIAL_KILL: "💀",
      GAME_END: "🏁",
      PAUSE_END: "▶️",
      PAUSE_START: "⏸️",
      FEAT_UPDATE: "🏆",
    };
    return iconMap[eventType] || "📍";
  };

  const getEventColor = (eventType: string) => {
    const colorMap: { [key: string]: string } = {
      CHAMPION_KILL: "bg-red-500/20 border-red-500/50",
      BUILDING_KILL: "bg-yellow-500/20 border-yellow-500/50",
      ELITE_MONSTER_KILL: "bg-purple-500/20 border-purple-500/50",
      TURRET_PLATE_DESTROYED: "bg-orange-500/20 border-orange-500/50",
      CHAMPION_SPECIAL_KILL: "bg-pink-500/20 border-pink-500/50",
      GAME_END: "bg-blue-500/20 border-blue-500/50",
      FEAT_UPDATE: "bg-amber-500/20 border-amber-500/50",
    };
    return colorMap[eventType] || "bg-gray-500/20 border-gray-500/50";
  };

  const getParticipantName = (participantId: number) => {
    const participant = matchData.info.participants[participantId - 1];
    return participant?.riotIdGameName || participant?.summonerName || `Player ${participantId}`;
  };

  const getEventDetails = (event: any) => {
    switch (event.type) {
      case "CHAMPION_KILL":
        const killer = event.killerId ? getParticipantName(event.killerId) : "Unknown";
        const victim = event.victimId ? getParticipantName(event.victimId) : "Unknown";
        const assists = event.assistingParticipantIds?.map((id: number) => getParticipantName(id)).join(", ") || "None";
        return {
          title: "Champion Kill",
          details: [
            { label: "Killer", value: killer },
            { label: "Victim", value: victim },
            { label: "Assists", value: assists },
            { label: "Bounty", value: event.bounty ? `${event.bounty}g` : "0g" },
          ],
        };
      case "BUILDING_KILL":
        const buildingKiller = event.killerId ? getParticipantName(event.killerId) : "Team";
        return {
          title: "Building Destroyed",
          details: [
            { label: "Type", value: event.buildingType?.replace("_", " ") || "Unknown" },
            { label: "Lane", value: event.laneType || "N/A" },
            { label: "Team", value: event.teamId === 100 ? "Blue" : "Red" },
            { label: "Destroyed by", value: buildingKiller },
          ],
        };
      case "ELITE_MONSTER_KILL":
        const monsterKiller = event.killerId ? getParticipantName(event.killerId) : "Unknown";
        return {
          title: "Elite Monster Kill",
          details: [
            { label: "Monster", value: event.monsterType || "Unknown" },
            { label: "Killer", value: monsterKiller },
            { label: "Team", value: event.killerTeamId === 100 ? "Blue" : "Red" },
          ],
        };
      case "TURRET_PLATE_DESTROYED":
        const plateKiller = event.killerId ? getParticipantName(event.killerId) : "Unknown";
        return {
          title: "Turret Plate Destroyed",
          details: [
            { label: "Lane", value: event.laneType || "N/A" },
            { label: "Team", value: event.teamId === 100 ? "Blue" : "Red" },
            { label: "Destroyed by", value: plateKiller },
          ],
        };
      case "CHAMPION_SPECIAL_KILL":
        return {
          title: "Special Kill",
          details: [
            { label: "Type", value: event.killType || "Unknown" },
            { label: "Killer", value: event.killerId ? getParticipantName(event.killerId) : "Unknown" },
          ],
        };
      case "FEAT_UPDATE":
        // Ignore 1001 events
        if (event.featValue === 1001) {
          return {
            title: "Feat Update",
            details: [{ label: "Type", value: "Ignored" }],
          };
        }
        
        const featTypeMap: { [key: number]: string } = {
          0: "Warfare",
          1: "First Turret",
          2: "Monster Slaying",
        };
        
        const featType = featTypeMap[event.featType] || `Unknown Feat (${event.featType})`;
        const featValue = event.featValue;
        
        // Check if it's a claim event (value 3 for warfare/monster slaying, value 1 for turret)
        const isClaimed = (event.featType === 0 && featValue === 3) || 
                         (event.featType === 1 && featValue === 1) || 
                         (event.featType === 2 && featValue === 3);
        
        return {
          title: "Feat Update",
          details: [
            { label: "Type", value: featType },
            { label: "Value", value: isClaimed ? "Claimed" : featValue.toString() },
            { label: "Team", value: event.teamId === 100 ? "Blue" : "Red" },
          ],
        };
      default:
        return {
          title: event.type.replace(/_/g, " "),
          details: [{ label: "Type", value: event.type }],
        };
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

  const handleEventClick = (event: any, buttonElement: HTMLButtonElement) => {
    // Clear all highlights first to force animation restart
    setHighlightedParticipants([]);
    setHighlightedBuilding(null);
    setHighlightedMonster(null);
    
    // Always update the selected event and position (even if clicking the same event)
    setSelectedEvent(event);
    const rect = buttonElement.getBoundingClientRect();
      setPopupPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
      
      // Navigate to the frame where this event occurred
      // Timeline frames are at 1 minute intervals (60000ms) - round up to next frame
      const frameIndex = Math.ceil(event.timestamp / 60000);
      setCurrentFrame(frameIndex);
      
      // Use setTimeout to ensure state clears before setting new highlights
      setTimeout(() => {
      // Highlight involved participants
      const participantsToHighlight: number[] = [];
      
      if (event.type === "CHAMPION_KILL") {
        if (event.killerId) participantsToHighlight.push(event.killerId);
        if (event.victimId) participantsToHighlight.push(event.victimId);
        if (event.assistingParticipantIds) {
          participantsToHighlight.push(...event.assistingParticipantIds);
        }
      } else if (event.type === "ELITE_MONSTER_KILL") {
        if (event.killerId) participantsToHighlight.push(event.killerId);
        if (event.assistingParticipantIds) {
          participantsToHighlight.push(...event.assistingParticipantIds);
        }
        
        // Highlight the monster at its position
        if (event.position) {
          setHighlightedMonster({
            position: event.position,
            monsterType: event.monsterType,
            teamId: event.killerTeamId
          });
          
          setTimeout(() => {
            setHighlightedMonster(null);
          }, 2000);
        }
      } else if (event.type === "TURRET_PLATE_DESTROYED") {
        if (event.killerId) participantsToHighlight.push(event.killerId);
        if (event.assistingParticipantIds) {
          participantsToHighlight.push(...event.assistingParticipantIds);
        }
      } else if (event.type === "BUILDING_KILL" && event.buildingType === "TOWER_BUILDING") {
        if (event.killerId) participantsToHighlight.push(event.killerId);
        if (event.assistingParticipantIds) {
          participantsToHighlight.push(...event.assistingParticipantIds);
        }
        
        // Highlight the tower with flash-in-out animation
        const teamPrefix = event.teamId === 100 ? "BLUE" : "RED";
        const laneType = event.laneType;
        const towerTier = event.towerType;
        const towerName = `${teamPrefix}_${laneType}_${towerTier}`;
        setHighlightedBuilding({ name: towerName, type: 'flash-in-out' });
        
        setTimeout(() => {
          setHighlightedBuilding(null);
        }, 2000);
      }
      
      if (event.type === "TURRET_PLATE_DESTROYED") {
        // Highlight the tower with flash-out animation
        const teamPrefix = event.teamId === 100 ? "BLUE" : "RED";
        const laneType = event.laneType;
        // Turret plates are on outer turrets
        const towerName = `${teamPrefix}_${laneType}_OUTER_TURRET`;
        setHighlightedBuilding({ name: towerName, type: 'flash-out' });
        
        setTimeout(() => {
          setHighlightedBuilding(null);
        }, 1000);
      }
      
      setHighlightedParticipants(participantsToHighlight);
      setTimeout(() => {
        setHighlightedParticipants([]);
      }, 2000);
      
      // Handle position highlighting
      if (event.position) {
        setHighlightPosition(event.position);
        onEventClick(event.position);
        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightPosition(null);
        }, 3000);
      }
      }, 10); // Small delay to ensure state clears before resetting
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedEvent && popupPosition) {
        const target = event.target as HTMLElement;
        // Check if click is outside the popup and event buttons
        if (!target.closest('.event-popup') && !target.closest('.event-button')) {
          setSelectedEvent(null);
          setPopupPosition(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedEvent, popupPosition]);

  return (
    <div className="pt-[25px] bg-[rgba(0,0,0,0.2)] rounded-lg p-4 border border-[#2a3544]/50 relative">
      
      <div 
        ref={containerRef}
        className="flex items-center gap-0 overflow-x-auto pb-2"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#7f1d1d #1a2332',
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            height: 8px;
          }
          div::-webkit-scrollbar-track {
            background: #1a2332;
            border-radius: 4px;
          }
          div::-webkit-scrollbar-thumb {
            background: #7f1d1d;
            border-radius: 4px;
          }
          div::-webkit-scrollbar-thumb:hover {
            background: #991b1b;
          }
        `}</style>
        
        {allEvents.map((event, idx) => (
          <div key={idx} className="flex items-center flex-shrink-0">
            <div className="p-2 flex flex-col items-center gap-1">
              <button
                onClick={(e) => handleEventClick(event, e.currentTarget)}
                className={`event-button w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl transition-all hover:scale-110 ${getEventColor(event.type)} ${
                  selectedEvent === event ? "ring-2 ring-blue-400" : ""
                }`}
              >
                {event.type === "CHAMPION_KILL" ? (
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/kills.png"
                    alt="Kill"
                    width={24}
                    height={24}
                    className="object-contain"
                    unoptimized
                  />
                ) : event.type === "TURRET_PLATE_DESTROYED" ? (
                  <div className="relative">
                    <Image
                      src={`/tower-${event.teamId}.png`}
                      alt="Turret Plate"
                      width={20}
                      height={20}
                      className="object-contain opacity-70"
                      unoptimized
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-yellow-400">
                      P
                    </div>
                  </div>
                ) : event.type === "FEAT_UPDATE" ? (
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/roleicon-mage.png"
                    alt="Feat"
                    width={24}
                    height={24}
                    className="object-contain"
                    unoptimized
                  />
                ) : event.type === "ELITE_MONSTER_KILL" ? (
                  event.monsterType === "DRAGON" ? (
                    <Image
                      src={event.monsterSubType === "ELDER_DRAGON" 
                        ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/elder-${event.killerTeamId}.png`
                        : `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dragon-${event.killerTeamId}.png`}
                      alt={event.monsterSubType === "ELDER_DRAGON" ? "Elder Dragon" : "Dragon"}
                      width={28}
                      height={28}
                      className="object-contain"
                      unoptimized
                    />
                  ) : event.monsterType === "BARON_NASHOR" ? (
                    <Image
                      src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-${event.killerTeamId}.png`}
                      alt="Baron"
                      width={28}
                      height={28}
                      className="object-contain"
                      unoptimized
                    />
                  ) : event.monsterType === "RIFTHERALD" ? (
                    <Image
                      src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-${event.killerTeamId}.png`}
                      alt="Herald"
                      width={28}
                      height={28}
                      className="object-contain"
                      unoptimized
                    />
                  ) : event.monsterType === "HORDE" ? (
                    <Image
                      src={event.killerTeamId === 100 ? "/grub-blue.png" : "/grub-red.png"}
                      alt="Grubs"
                      width={28}
                      height={28}
                      className="object-contain"
                      unoptimized
                    />
                  ) : event.monsterType === "ATAKHAN" ? (
                    <Image
                      src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/vilemaw-${event.killerTeamId}.png`}
                      alt="Atakhan"
                      width={28}
                      height={28}
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    getEventIcon(event.type)
                  )
                ) : event.type === "DRAGON_SOUL_CLAIMED" ? (
                  <Image
                    src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/water-${event.teamId}.png`}
                    alt="Dragon Soul"
                    width={28}
                    height={28}
                    className="object-contain"
                    unoptimized
                  />
                ) : event.type === "GAME_END" ? (
                  <Image
                    src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/nexus_building_${event.winningTeam === 100 ? 'blue' : 'red'}.png`}
                    alt="Game End"
                    width={28}
                    height={28}
                    className="object-contain"
                    unoptimized
                  />
                ) : event.type === "BUILDING_KILL" && event.buildingType === "TOWER_BUILDING" ? (
                  <Image
                    src={`/tower-${event.teamId}.png`}
                    alt="Tower"
                    width={24}
                    height={24}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  getEventIcon(event.type)
                )}
              </button>
              <span className="text-[9px] text-gray-400 font-mono whitespace-nowrap">
                {formatTime(event.timestamp)}
              </span>
            </div>
            
            {/* Connecting Line */}
            {idx < allEvents.length - 1 && (
              <div className="w-6 h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Popup Card - Rendered outside scroll container */}
      {selectedEvent && popupPosition && (
        <div 
          className="event-popup fixed z-[9999]"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            transform: 'translate(-50%, calc(-100% - 8px))',
          }}
        >
          {selectedEvent.type === "CHAMPION_KILL" ? (
            // Special layout for Champion Kill
            <div className="bg-[#1a2332] rounded-lg p-3 border border-[#2a3a4a] shadow-xl">
              <h4 className="text-white font-semibold text-xs mb-3 text-center">
                Champion Kill
              </h4>
              <div className="flex items-center gap-2">
                {/* Assists Grid (Left) - Only show if there are assists */}
                {selectedEvent.assistingParticipantIds && selectedEvent.assistingParticipantIds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {selectedEvent.assistingParticipantIds.map((assistId: number) => {
                      const assistParticipant = matchData.info.participants[assistId - 1];
                      return (
                        <div key={assistId} className="w-6 h-6 rounded border border-[#3a4a5a] overflow-hidden">
                          <Image
                            src={getChampionImageUrl(assistParticipant?.championName || "")}
                            alt="Assist"
                            width={24}
                            height={24}
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Killer (Bigger) */}
                <div className="w-10 h-10 rounded border-2 border-green-500 overflow-hidden flex-shrink-0">
                  <Image
                    src={
                      selectedEvent.killerId && selectedEvent.killerId > 0
                        ? getChampionImageUrl(
                            matchData.info.participants[selectedEvent.killerId - 1]?.championName || ""
                          )
                        : `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/minion-${
                            matchData.info.participants[selectedEvent.victimId - 1]?.teamId === 100 ? "200" : "100"
                          }.jpg`
                    }
                    alt={selectedEvent.killerId > 0 ? "Killer" : "Minion"}
                    width={40}
                    height={40}
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Kill Icon with Bounty */}
                <div className="flex flex-col items-center gap-1">
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/kills.png"
                    alt="Kill"
                    width={24}
                    height={24}
                    className="object-contain"
                    unoptimized
                  />
                  {selectedEvent.bounty > 0 && (
                    <span className="text-[9px] text-yellow-400 font-semibold">
                      {selectedEvent.bounty}g
                    </span>
                  )}
                </div>

                {/* Victim (Bigger) */}
                {selectedEvent.victimId && selectedEvent.victimId > 0 && (
                  <div className="w-10 h-10 rounded border-2 border-red-500 overflow-hidden flex-shrink-0">
                    <Image
                      src={getChampionImageUrl(
                        matchData.info.participants[selectedEvent.victimId - 1]?.championName || ""
                      )}
                      alt="Victim"
                      width={40}
                      height={40}
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>
            </div>
          ) : selectedEvent.type === "TURRET_PLATE_DESTROYED" ? (
            // Special layout for Turret Plate Destroyed
            <div className="bg-[#1a2332] rounded-lg p-3 border border-[#2a3a4a] shadow-xl">
              <h4 className="text-white font-semibold text-xs mb-3 text-center">
                Turret Plate Destroyed
              </h4>
              <div className="flex items-center justify-center gap-2">
                {/* Destroyer Champion */}
                <div className="w-10 h-10 rounded border-2 border-orange-500 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <Image
                    src={
                      selectedEvent.killerId && selectedEvent.killerId > 0
                        ? getChampionImageUrl(
                            matchData.info.participants[selectedEvent.killerId - 1]?.championName || ""
                          )
                        : `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/minion-${selectedEvent.teamId === 100 ? "200" : "100"}.jpg`
                    }
                    alt={selectedEvent.killerId > 0 ? "Destroyer" : "Minion"}
                    width={40}
                    height={40}
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Kill Icon with 125g */}
                <div className="flex flex-col items-center justify-center gap-1">
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/kills.png"
                    alt="Gold"
                    width={24}
                    height={24}
                    className="object-contain"
                    unoptimized
                  />
                  <span className="text-[9px] text-yellow-400 font-semibold">
                    125g
                  </span>
                </div>

                {/* Turret Plate Icon */}
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/roleicon-tank.png"
                    alt="Turret Plate"
                    width={40}
                    height={40}
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          ) : selectedEvent.type === "ELITE_MONSTER_KILL" ? (
            // Special layout for Elite Monster Kill
            <div className="bg-[#1a2332] rounded-lg p-3 border border-[#2a3a4a] shadow-xl">
              <h4 className="text-white font-semibold text-xs mb-3 text-center">
                Elite Monster Kill
              </h4>
              <div className="flex items-center justify-center gap-2">
                {/* Assists Grid (Left) - Only show if there are assists */}
                {selectedEvent.assistingParticipantIds && selectedEvent.assistingParticipantIds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {selectedEvent.assistingParticipantIds.map((assistId: number) => {
                      const assistParticipant = matchData.info.participants[assistId - 1];
                      return (
                        <div key={assistId} className="w-6 h-6 rounded border border-[#3a4a5a] overflow-hidden">
                          <Image
                            src={getChampionImageUrl(assistParticipant?.championName || "")}
                            alt="Assist"
                            width={24}
                            height={24}
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Killer Champion */}
                <div className="w-10 h-10 rounded border-2 border-purple-500 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <Image
                    src={
                      selectedEvent.killerId && selectedEvent.killerId > 0
                        ? getChampionImageUrl(
                            matchData.info.participants[selectedEvent.killerId - 1]?.championName || ""
                          )
                        : `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/minion-${selectedEvent.killerTeamId === 100 ? "100" : "200"}.jpg`
                    }
                    alt={selectedEvent.killerId > 0 ? "Killer" : "Minion"}
                    width={40}
                    height={40}
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Kill Icon */}
                <div className="flex flex-col items-center justify-center">
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/kills.png"
                    alt="Kill"
                    width={24}
                    height={24}
                    className="object-contain"
                    unoptimized
                  />
                </div>

                {/* Monster Icon */}
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  {selectedEvent.monsterType === "DRAGON" ? (
                    <Image
                      src={selectedEvent.monsterSubType === "ELDER_DRAGON"
                        ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/elder-${selectedEvent.killerTeamId}.png`
                        : `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dragon-${selectedEvent.killerTeamId}.png`}
                      alt={selectedEvent.monsterSubType === "ELDER_DRAGON" ? "Elder Dragon" : "Dragon"}
                      width={40}
                      height={40}
                      className="object-contain"
                      unoptimized
                    />
                  ) : selectedEvent.monsterType === "BARON_NASHOR" ? (
                    <Image
                      src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-${selectedEvent.killerTeamId}.png`}
                      alt="Baron"
                      width={40}
                      height={40}
                      className="object-contain"
                      unoptimized
                    />
                  ) : selectedEvent.monsterType === "RIFTHERALD" ? (
                    <Image
                      src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-${selectedEvent.killerTeamId}.png`}
                      alt="Herald"
                      width={40}
                      height={40}
                      className="object-contain"
                      unoptimized
                    />
                  ) : selectedEvent.monsterType === "HORDE" ? (
                    <Image
                      src={selectedEvent.killerTeamId === 100 ? "/grub-blue.png" : "/grub-red.png"}
                      alt="Grubs"
                      width={40}
                      height={40}
                      className="object-contain"
                      unoptimized
                    />
                  ) : selectedEvent.monsterType === "ATAKHAN" ? (
                    <Image
                      src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/vilemaw-${selectedEvent.killerTeamId}.png`}
                      alt="Atakhan"
                      width={40}
                      height={40}
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="text-2xl">🐉</span>
                  )}
                </div>
              </div>
            </div>
          ) : selectedEvent.type === "BUILDING_KILL" && selectedEvent.buildingType === "TOWER_BUILDING" ? (
            // Special layout for Tower Kill
            <div className="bg-[#1a2332] rounded-lg p-3 border border-[#2a3a4a] shadow-xl">
              <h4 className="text-white font-semibold text-xs mb-3 text-center">
                Tower Destroyed
              </h4>
              <div className="flex items-center justify-center gap-2">
                {/* Assists Grid (Left) - Only show if there are assists */}
                {selectedEvent.assistingParticipantIds && selectedEvent.assistingParticipantIds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {selectedEvent.assistingParticipantIds.map((assistId: number) => {
                      const assistParticipant = matchData.info.participants[assistId - 1];
                      return (
                        <div key={assistId} className="w-6 h-6 rounded border border-[#3a4a5a] overflow-hidden">
                          <Image
                            src={getChampionImageUrl(assistParticipant?.championName || "")}
                            alt="Assist"
                            width={24}
                            height={24}
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Destroyer Champion */}
                <div className="w-10 h-10 rounded border-2 border-yellow-500 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <Image
                    src={
                      selectedEvent.killerId && selectedEvent.killerId > 0
                        ? getChampionImageUrl(
                            matchData.info.participants[selectedEvent.killerId - 1]?.championName || ""
                          )
                        : `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/minion-${selectedEvent.teamId === 100 ? "200" : "100"}.jpg`
                    }
                    alt={selectedEvent.killerId > 0 ? "Destroyer" : "Minion"}
                    width={40}
                    height={40}
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Kill Icon */}
                <div className="flex flex-col items-center justify-center">
                  <Image
                    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/kills.png"
                    alt="Kill"
                    width={24}
                    height={24}
                    className="object-contain"
                    unoptimized
                  />
                </div>

                {/* Tower Icon */}
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <Image
                    src={`/tower-${selectedEvent.teamId}.png`}
                    alt="Tower"
                    width={32}
                    height={32}
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          ) : selectedEvent.type === "GAME_END" ? (
            // Special layout for Game End
            <div className={`rounded-lg p-3 border shadow-xl ${
              selectedEvent.winningTeam === 100 
                ? 'bg-blue-900/50 border-blue-500' 
                : 'bg-red-900/50 border-red-500'
            }`}>
              <div className="text-center">
                <span className={`text-xs font-bold ${
                  selectedEvent.winningTeam === 100 ? 'text-blue-400' : 'text-red-400'
                }`}>
                  {selectedEvent.winningTeam === 100 ? 'Blue Team' : 'Red Team'} Victory
                </span>
              </div>
            </div>
          ) : (
            // Default layout for other events
            <div className="bg-[#1a2332] rounded-lg p-3 border border-[#2a3a4a] shadow-xl w-[200px]">
              <h4 className="text-white font-semibold text-xs mb-2">
                {getEventDetails(selectedEvent).title}
              </h4>
              <div className="space-y-1">
                {getEventDetails(selectedEvent).details.map((detail, detailIdx) => (
                  <div key={detailIdx} className="flex justify-between text-[10px]">
                    <span className="text-gray-400">{detail.label}:</span>
                    <span className="text-white truncate ml-2">{detail.value}</span>
                  </div>
                ))}
                {selectedEvent.position && (
                  <div className="flex justify-between text-[10px] mt-2 pt-2 border-t border-[#2a3544]/50">
                    <span className="text-gray-400">Position:</span>
                    <span className="text-white">
                      ({Math.round(selectedEvent.position.x)}, {Math.round(selectedEvent.position.y)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
