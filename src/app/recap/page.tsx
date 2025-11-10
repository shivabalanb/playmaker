"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TitleSlide } from "./components/TitleSlide";
import { ChampionRoleStatsSlide } from "./components/ChampionRoleStatsSlide";
import { VisionObjectivesSlide } from "./components/VisionObjectivesSlide";
import { RecordsMomentsSlide } from "./components/RecordsMomentsSlide";
import { PlaystyleSlide } from "./components/PlaystyleSlide";
import { FinalSlide } from "./components/FinalSlide";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { SlideNavigation } from "./components/SlideNavigation";
import { CorePerformanceSlide } from "./components/CorePerformanceSlide";
import { CorePerformanceEconomySlide } from "./components/CorePerformanceEconomySlide";
import { FunFactsSlide } from "./components/FunFactsSlide";
import { PoemSlide } from "./components/PoemSlide";

const SLIDE_DURATION = 6000; // 6 seconds per slide

interface RecapData {
  stats?: {
    summary?: {
      totalGames?: number;
      wins?: number;
      losses?: number;
      winRate?: number;
    };
    corePerformance?: {
      totalGames?: number;
      wins?: number;
      losses?: number;
      winRate?: number;
      totalGameTime?: number;
      averageGameDuration?: number;
      totalKills?: number;
      totalDeaths?: number;
      totalAssists?: number;
      averageKDA?: number;
      killParticipation?: number;
      totalDamageDealt?: number;
      totalDamageToChampions?: number;
      averageDamagePerGame?: number;
      highestDamageGame?: {
        matchId: string;
        damage: number;
        champion: string;
      };
      totalGoldEarned?: number;
      totalGoldSpent?: number;
      averageGoldPerMinute?: number;
      totalBountyGold?: number;
    };
    favoriteChampion?: {
      champion: string;
      championId: number;
      gamesPlayed: number;
      wins: number;
      losses: number;
      winRate: number;
      averageKDA: number;
      averageDamage: number;
      averageGoldPerMin: number;
      favoriteRole: string;
      bestGame: {
        matchId: string;
        kda: number;
        damage: number;
        win: boolean;
      };
    };
    top5Champions?: Array<{
      champion: string;
      championId: number;
      gamesPlayed: number;
      wins: number;
      losses: number;
      winRate: number;
      averageKDA: number;
      averageDamage: number;
      averageGoldPerMin: number;
      favoriteRole: string;
      bestGame: {
        matchId: string;
        kda: number;
        damage: number;
        win: boolean;
      };
    }>;
    favoriteRole?: {
      role: string;
    };
    roleDistribution?: Array<{
      role: string;
      games: number;
      wins: number;
      losses: number;
      winRate: number;
      avgKDA: number;
    }>;
    achievements?: {
      pentakills?: number;
      quadrakills?: number;
      tripleKills?: number;
      soloKills?: number;
      firstBloods?: number;
      perfectGames?: number;
      flawlessAces?: number;
      epicMonsterSteals?: number;
    };
    gloryMoments?: {
      pentakills?: number;
      quadrakills?: number;
      tripleKills?: number;
    };
    personalRecords?: {
      mostKills?: { value: number; matchId?: string };
      mostAssists?: { value: number; matchId?: string };
      mostDeaths?: { value: number; matchId?: string };
    };
    clutchMoments?: {
      outnumberedKills?: number;
      killsUnderOwnTurret?: number;
      savesAllyFromDeath?: number;
      survivedThreeImmobilizes?: number;
    };
    trends?: {
      longestWinStreak?: { length: number; start?: string };
      longestLossStreak?: { length: number; start?: string };
      currentStreak?: { type: boolean; length: number };
      performanceOverTime?: {
        recent10Games?: { winRate: number; avgKDA: number };
        recent20Games?: { winRate: number; avgKDA: number };
      };
    };
    vision?: {
      totalVisionScore?: number;
      averageVisionScore?: number;
      totalWardsPlaced?: number;
      totalWardsDestroyed?: number;
      totalControlWardsPlaced?: number;
      visionScorePerMinute?: number;
    };
    objectives?: {
      totalDragonTakedowns?: number;
      totalBaronTakedowns?: number;
      totalTurretTakedowns?: number;
      firstTurretRate?: number;
      epicMonsterSteals?: number;
      riftHeraldTakedowns?: number;
    };
    communication?: {
      totalPings?: number;
      averagePingsPerGame?: number;
      pingBreakdown?: {
        assistMe?: number;
        danger?: number;
        onMyWay?: number;
        enemyMissing?: number;
        enemyVision?: number;
        getBack?: number;
        retreat?: number;
        command?: number;
        allIn?: number;
      };
    };
    performance?: Record<string, unknown>;
    champions?: {
      totalUnique?: number;
      all?: Array<{
        champion: string;
        championId: number;
        gamesPlayed: number;
        wins: number;
        losses: number;
        winRate: number;
        averageKDA: number;
        averageDamage: number;
        averageGoldPerMin: number;
        favoriteRole: string;
        bestGame: {
          matchId: string;
          kda: number;
          damage: number;
          win: boolean;
        };
        totalKills?: number;
        totalDeaths?: number;
        totalAssists?: number;
        totalGameTime?: number;
      }>;
    };
  };
  insights?: {
    overview?: string;
    strengths?: string[];
    weaknesses?: string[];
    funFacts?: string[];
    clutchMomentsInsight?: string;
    playstyle?: string;
    recommendations?: string[];
    poem?: string;
  };
  summonerInfo?: {
    profileIconId?: number;
    summonerLevel?: number;
    name?: string;
  };
  platform?: string;
}

export default function SeasonRecapPage() {
  const searchParams = useSearchParams();
  const puuid = searchParams.get("puuid");
  const region = searchParams.get("region");
  const summonerName = searchParams.get("name");

  console.log("[RecapPage] Summoner name from URL:", summonerName);
  console.log("[RecapPage] PUUID:", puuid);
  console.log("[RecapPage] Region:", region);

  const [status, setStatus] = useState<"processing" | "complete" | "error">(
    "processing"
  );
  const [recapData, setRecapData] = useState<RecapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const slideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!puuid) {
      setTimeout(() => {
        setError("No PUUID provided");
        setStatus("error");
      }, 0);
      return;
    }

    // Poll for status
    const pollStatus = async () => {
      try {
        const statusRes = await fetch(
          `/api/riot/recap/status?puuid=${puuid}&region=${region || "americas"}`
        );
        const statusData = await statusRes.json();

        if (statusData.status === "available" && statusData.data) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          setStatus("complete");
          setRecapData(statusData.data);
        } else if (statusData.status === "processing") {
          setStatus("processing");
        } else if (statusData.status === "not_eligible") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          setStatus("error");
          setError(statusData.message || "Not eligible for recap");
        } else if (statusData.status === "eligible") {
          setStatus("processing");
        } else if (statusData.error) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          setStatus("error");
          setError(
            statusData.details || statusData.error || "Failed to check status"
          );
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    };

    pollStatus();
    pollIntervalRef.current = setInterval(pollStatus, 5000);
    timeoutRef.current = setTimeout(
      () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        setStatus("error");
        setError("Recap generation timed out. Please try again.");
      },
      5 * 60 * 1000
    );

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [puuid, region]);

  // Auto-advance slides (only when not paused)
  useEffect(() => {
    if (status !== "complete" || !recapData || isPaused) return;

    const totalSlides = getTotalSlides(recapData);

    slideTimeoutRef.current = setTimeout(() => {
      if (currentSlide < totalSlides - 1) {
        setCurrentSlide((prev) => prev + 1);
      }
    }, SLIDE_DURATION);

    return () => {
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current);
      }
    };
  }, [currentSlide, status, recapData, isPaused]);

  const handleSlideChange = (index: number) => {
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
    }
    setCurrentSlide(index);
  };

  const handleSkip = () => {
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
    }
    setCurrentSlide((prev) => prev + 1);
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
    }
  };

  // Loading state
  if (status === "processing") {
    return <LoadingState />;
  }

  // Error state
  if (status === "error") {
    return <ErrorState error={error || "Unknown error"} />;
  }

  if (!recapData) {
    return null;
  }

  const slides = buildSlides(recapData, puuid, region, summonerName);
  const totalSlides = slides.length;

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      <AnimatePresence mode="wait">
        {slides[currentSlide] && (
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {slides[currentSlide]}
          </motion.div>
        )}
      </AnimatePresence>

      <SlideNavigation
        totalSlides={totalSlides}
        currentSlide={currentSlide}
        onSlideChange={handleSlideChange}
        onSkip={handleSkip}
        canSkip={currentSlide < totalSlides - 1}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
      />
    </div>
  );
}

function getTotalSlides(recapData: RecapData): number {
  let count = 1; // Title slide
  if (recapData.stats?.corePerformance) count += 2; // Core Performance (2 slides)
  if (
    recapData.stats?.favoriteChampion ||
    recapData.stats?.top5Champions ||
    recapData.stats?.favoriteRole ||
    recapData.stats?.roleDistribution
  )
    count++; // Champion & Role Stats
  if (
    recapData.stats?.vision ||
    recapData.stats?.objectives ||
    recapData.stats?.communication
  )
    count++; // Vision & Objectives
  if (
    recapData.stats?.personalRecords ||
    recapData.stats?.clutchMoments ||
    recapData.stats?.gloryMoments
  )
    count++; // Records & Moments (combined)
  if (recapData.insights?.funFacts) count++; // Fun Facts
  if (recapData.insights?.playstyle) count++; // Playstyle
  if (recapData.insights?.poem) count++; // Poem
  count++; // Final slide
  return count;
}

function buildSlides(
  recapData: RecapData,
  puuid: string | null,
  region: string | null,
  summonerName: string | null
): React.ReactElement[] {
  const slides: React.ReactElement[] = [];
  const stats = recapData.stats || {};
  const insights = recapData.insights || {};
  const summary = stats.summary || {};
  const corePerformance = stats.corePerformance || {};
  const achievements = stats.achievements || {};
  const personalRecords = stats.personalRecords || {};
  const clutchMoments = stats.clutchMoments || {};

  // Slide 1: Title
  slides.push(
    <TitleSlide
      key="title"
      totalGames={summary.totalGames || corePerformance.totalGames || 0}
    />
  );

  // Slide 2 & 3: Core Performance (2 slides)
  if (corePerformance && Object.keys(corePerformance).length > 0) {
    // Determine most active hour of day from time patterns, if present
    const gamesByTime = (stats as any)?.timePatterns?.gamesByTimeOfDay as
      | Record<string, number>
      | undefined;
    let mostActiveHour: number | undefined = undefined;
    if (gamesByTime && Object.keys(gamesByTime).length > 0) {
      const top = Object.entries(gamesByTime).sort(
        (a, b) => (b[1] as number) - (a[1] as number)
      )[0];
      if (top) mostActiveHour = Number(top[0]);
    }
    slides.push(
      <CorePerformanceSlide
        key="core-performance-1"
        totalGames={corePerformance.totalGames || 0}
        wins={corePerformance.wins || 0}
        losses={corePerformance.losses || 0}
        winRate={corePerformance.winRate || 0}
        totalKills={corePerformance.totalKills || 0}
        totalDeaths={corePerformance.totalDeaths || 0}
        totalAssists={corePerformance.totalAssists || 0}
        averageKDA={corePerformance.averageKDA || 0}
        killParticipation={corePerformance.killParticipation || 0}
        totalGameTime={corePerformance.totalGameTime || 0}
        averageGameDuration={corePerformance.averageGameDuration || 0}
        totalGoldSpent={corePerformance.totalGoldSpent || 0}
        totalDamageDealt={corePerformance.totalDamageDealt || 0}
      />
    );
    slides.push(
      <CorePerformanceEconomySlide
        key="core-performance-2"
        totalDamageToChampions={corePerformance.totalDamageToChampions || 0}
        averageDamagePerGame={corePerformance.averageDamagePerGame || 0}
        totalGoldEarned={corePerformance.totalGoldEarned || 0}
        averageGoldPerMinute={corePerformance.averageGoldPerMinute || 0}
        totalBountyGold={corePerformance.totalBountyGold || 0}
        averageGameDuration={corePerformance.averageGameDuration || 0}
        totalGameTime={corePerformance.totalGameTime || 0}
        mostActiveHour={mostActiveHour}
      />
    );
  }

  // Slide 4: Champion & Role Stats
  if (
    stats.favoriteChampion ||
    stats.top5Champions ||
    stats.favoriteRole ||
    stats.roleDistribution ||
    stats.champions
  ) {
    slides.push(
      <ChampionRoleStatsSlide
        key="champion-role"
        favoriteChampion={stats.favoriteChampion}
        top5Champions={stats.top5Champions}
        favoriteRole={stats.favoriteRole}
        roleDistribution={stats.roleDistribution}
        allChampions={stats.champions?.all}
        totalUniqueChampions={stats.champions?.totalUnique}
      />
    );
  }

  // Slide 6: Vision & Objectives
  if (stats.vision || stats.objectives || stats.communication) {
    slides.push(
      <VisionObjectivesSlide
        key="vision-objectives"
        vision={stats.vision}
        objectives={stats.objectives}
        communication={stats.communication}
      />
    );
  }

  // Slide 8: Records & Moments (Combined)
  if (personalRecords || clutchMoments || achievements) {
    slides.push(
      <RecordsMomentsSlide
        key="records-moments"
        personalRecords={personalRecords}
        clutchMoments={clutchMoments}
        achievements={achievements}
        clutchMomentsInsight={insights.clutchMomentsInsight}
      />
    );
  }

  // Slide 13: Fun Facts
  if (insights.funFacts && insights.funFacts.length > 0) {
    slides.push(<FunFactsSlide key="funfacts" funFacts={insights.funFacts} />);
  }

  // Slide 14: Playstyle
  if (insights.playstyle) {
    slides.push(
      <PlaystyleSlide
        key="playstyle"
        playstyle={{ description: insights.playstyle }}
        strengths={insights.strengths}
        improvements={insights.improvements || insights.recommendations}
      />
    );
  }

  // Slide 15: Poem
  if (insights.poem) {
    slides.push(<PoemSlide key="poem" poem={insights.poem} />);
  }

  // Final slide
  slides.push(
    <FinalSlide
      key="final"
      puuid={puuid}
      region={region}
      summonerName={summonerName}
      recapData={recapData}
    />
  );

  return slides;
}
