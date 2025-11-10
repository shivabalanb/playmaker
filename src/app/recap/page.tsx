"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TitleSlide } from "./components/TitleSlide";
import { FavoriteChampionSlide } from "./components/FavoriteChampionSlide";
import { Top5ChampionsSlide } from "./components/Top5ChampionsSlide";
import { SeasonSummarySlide } from "./components/SeasonSummarySlide";
import { GloryMomentsSlide } from "./components/GloryMomentsSlide";
import { PersonalRecordsSlide } from "./components/PersonalRecordsSlide";
import { PlaystyleSlide } from "./components/PlaystyleSlide";
import { FinalSlide } from "./components/FinalSlide";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { SlideNavigation } from "./components/SlideNavigation";

const SLIDE_DURATION = 5000; // 5 seconds per slide

interface RecapData {
  stats?: {
    summary?: {
      totalGames?: number;
      wins?: number;
      losses?: number;
      winRate?: number;
    };
    favoriteChampion?: {
      champion?: string;
      games?: number;
      winRate?: number;
      avgKDA?: number;
    };
    top5Champions?: Array<{
      champion: string;
      games: number;
      winRate: number;
    }>;
    gloryMoments?: {
      pentakills?: number;
      quadrakills?: number;
      tripleKills?: number;
    };
    personalRecords?: {
      mostKills?: { value: number };
      mostAssists?: { value: number };
      mostDeaths?: { value: number };
    };
    performance?: Record<string, unknown>;
    champions?: { totalUnique?: number };
  };
  insights?: {
    playstyle?: { type?: string; description?: string };
    strengths?: string[];
    recommendations?: string[];
  };
}

export default function SeasonRecapPage() {
  const searchParams = useSearchParams();
  const puuid = searchParams.get("puuid");
  const region = searchParams.get("region");

  const [status, setStatus] = useState<"processing" | "complete" | "error">(
    "processing"
  );
  const [recapData, setRecapData] = useState<RecapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
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

  // Auto-advance slides
  useEffect(() => {
    if (status !== "complete" || !recapData) return;

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
  }, [currentSlide, status, recapData]);

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

  const slides = buildSlides(recapData, puuid, region);
  const totalSlides = slides.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1a2332] to-[#0f1923] text-white overflow-hidden relative">
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
      />
    </div>
  );
}

function getTotalSlides(recapData: RecapData): number {
  let count = 1; // Title slide
  if (recapData.stats?.favoriteChampion) count++;
  if (recapData.stats?.top5Champions?.length) count++;
  if (recapData.stats?.summary) count++;
  if (recapData.stats?.gloryMoments) count++;
  if (recapData.stats?.personalRecords) count++;
  if (recapData.insights) count++;
  count++; // Final slide
  return count;
}

function buildSlides(
  recapData: RecapData,
  puuid: string | null,
  region: string | null
): React.ReactElement[] {
  const slides: React.ReactElement[] = [];
  const stats = recapData.stats || {};
  const insights = recapData.insights || {};
  const summary = stats.summary || {};
  const favoriteChampion = stats.favoriteChampion;
  const top5Champions = stats.top5Champions || [];
  const gloryMoments = stats.gloryMoments || {};
  const personalRecords = stats.personalRecords || {};

  // Slide 1: Title
  slides.push(<TitleSlide key="title" totalGames={summary.totalGames || 0} />);

  // Slide 2: Favorite Champion
  if (favoriteChampion?.champion) {
    slides.push(
      <FavoriteChampionSlide
        key="favorite"
        champion={favoriteChampion.champion}
        games={favoriteChampion.games || 0}
        winRate={favoriteChampion.winRate || 0}
        avgKDA={favoriteChampion.avgKDA || 0}
      />
    );
  }

  // Slide 3: Top 5 Champions
  if (top5Champions.length > 0) {
    slides.push(<Top5ChampionsSlide key="top5" champions={top5Champions} />);
  }

  // Slide 4: Season Summary
  if (summary) {
    slides.push(
      <SeasonSummarySlide
        key="summary"
        totalGames={summary.totalGames || 0}
        wins={summary.wins || 0}
        winRate={summary.winRate || 0}
        totalChampions={
          (stats as { champions?: { totalUnique?: number } }).champions
            ?.totalUnique || 0
        }
      />
    );
  }

  // Slide 5: Glory Moments
  if (gloryMoments) {
    slides.push(
      <GloryMomentsSlide
        key="glory"
        pentakills={gloryMoments.pentakills || 0}
        quadrakills={gloryMoments.quadrakills || 0}
        tripleKills={gloryMoments.tripleKills || 0}
      />
    );
  }

  // Slide 6: Personal Records
  if (personalRecords) {
    slides.push(
      <PersonalRecordsSlide
        key="records"
        mostKills={personalRecords.mostKills?.value || 0}
        mostAssists={personalRecords.mostAssists?.value || 0}
        mostDeaths={personalRecords.mostDeaths?.value || 0}
      />
    );
  }

  // Slide 7: Playstyle & Insights
  if (insights) {
    slides.push(
      <PlaystyleSlide
        key="insights"
        playstyle={insights.playstyle}
        strengths={insights.strengths}
        recommendations={insights.recommendations}
      />
    );
  }

  // Final slide
  slides.push(<FinalSlide key="final" puuid={puuid} region={region} />);

  return slides;
}
