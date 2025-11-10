"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getProfileIconUrl } from "@/lib/riot/assets";

const SLIDE_DURATION = 6000; // 6 seconds per slide

interface ComparisonViewProps {
  data: {
    player1: {
      puuid: string;
      name?: string;
      summonerInfo?: {
        profileIconId: number;
        summonerLevel?: number;
        name?: string;
      };
      recap: any;
    };
    player2: {
      puuid: string;
      name?: string;
      summonerInfo?: {
        profileIconId: number;
        summonerLevel?: number;
        name?: string;
      };
      recap: any;
    };
    insights?: {
      title: string;
      winner: "player1" | "player2" | "tie";
      summary: string;
      playstyles?: string;
      categories: Array<{
        category: string;
        winner: "player1" | "player2" | "tie";
        insight: string;
        emoji: string;
      }>;
      funFacts: string[];
      roast: string;
      verdict: string;
      synergy?: string;
    };
  };
  region: string;
}

export function ComparisonView({ data, region }: ComparisonViewProps) {
  const { player1, player2, insights } = data;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const slideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [player1Icon, setPlayer1Icon] = useState<number>(29);
  const [player2Icon, setPlayer2Icon] = useState<number>(29);

  const totalSlides = 4; // Title, Insights, Playstyle, Winner Reveal

  // Get profile icons from comparison data
  useEffect(() => {
    // Profile icons are at top level in comparison data
    const p1Icon = player1.summonerInfo?.profileIconId || player1.recap?.summonerInfo?.profileIconId || 29;
    const p2Icon = player2.summonerInfo?.profileIconId || player2.recap?.summonerInfo?.profileIconId || 29;
    
    console.log('[ComparisonView] Player1 icon:', p1Icon);
    console.log('[ComparisonView] Player2 icon:', p2Icon);
    
    setPlayer1Icon(p1Icon);
    setPlayer2Icon(p2Icon);
  }, [player1, player2]);
  


  // Auto-advance slides
  useEffect(() => {
    if (isPaused) return;

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
  }, [currentSlide, isPaused, totalSlides]);

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
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <AnimatePresence mode="wait">
        {/* Slide 1: Title */}
        {currentSlide === 0 && (
          <motion.div
            key="title"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: "url('/splash3.png')",
              }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/70" />

            <div className="relative z-10 text-center px-8 max-w-6xl mx-auto">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="text-[3rem] md:text-[4.5rem] font-medium tracking-tight leading-none text-white mb-8"
              >
                {insights?.title || "Battle of the Rift"}
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-lg md:text-xl text-gray-300 font-light leading-relaxed max-w-3xl mx-auto mb-16"
              >
                {insights?.summary || "Two players enter, one legend emerges"}
              </motion.p>
              
              <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-orange-500/20 backdrop-blur-sm border border-orange-500/40 rounded-2xl p-5 flex items-center gap-4"
                >
                  <img 
                    src={getProfileIconUrl(player1Icon)} 
                    alt={`${player1.name} icon`}
                    className="w-16 h-16 rounded-full border-2 border-orange-400/50"
                  />
                  <div className="text-2xl md:text-3xl font-light text-white">{player1.name || "Unknown"}</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-blue-500/20 backdrop-blur-sm border border-blue-500/40 rounded-2xl p-5 flex items-center gap-4"
                >
                  <img 
                    src={getProfileIconUrl(player2Icon)} 
                    alt={`${player2.name} icon`}
                    className="w-16 h-16 rounded-full border-2 border-blue-400/50"
                  />
                  <div className="text-2xl md:text-3xl font-light text-white">{player2.name || "Unknown"}</div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Slide 2: Insights Breakdown */}
        {currentSlide === 1 && insights && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: "url('/splash5.png')",
              }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/70" />

            <div className="relative z-10 text-center px-8 max-w-6xl mx-auto w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-6"
              >
                <div className="text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-2">
                  The Breakdown
                </div>
                <h2 className="text-4xl md:text-5xl font-light text-white">
                  Head to Head
                </h2>
              </motion.div>

              {/* Categories Grid - Insight-focused */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                {insights.categories && insights.categories.slice(0, 6).map((category, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 text-left"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{category.emoji}</span>
                      <div className="flex-1">
                        <h3 className="text-base font-light text-white mb-1">
                          {category.category}
                        </h3>
                        <div
                          className={`text-sm font-light ${
                            category.winner === "player1"
                              ? "text-blue-400"
                              : category.winner === "player2"
                                ? "text-purple-400"
                                : "text-gray-400"
                          }`}
                        >
                          Winner: {category.winner === "player1"
                            ? player1.name
                            : category.winner === "player2"
                              ? player2.name
                              : "Tie"}
                        </div>
                      </div>
                    </div>
                    <p className="text-base text-gray-300 font-light leading-relaxed">
                      {category.insight}
                    </p>
                  </motion.div>
                ))}
              </div>

            </div>
          </motion.div>
        )}

        {/* Slide 3: Playstyle Comparison */}
        {currentSlide === 2 && insights && (
          <motion.div
            key="playstyle"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: "url('/splash6.png')",
              }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/70" />

            <div className="relative z-10 text-center px-8 max-w-5xl mx-auto w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <div className="text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-2">
                  Playstyle Analysis
                </div>
                <h2 className="text-4xl md:text-5xl font-light text-white">
                  How You Play
                </h2>
              </motion.div>

              {/* Playstyle Description */}
              {insights.playstyles && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6 max-w-4xl mx-auto"
                >
                  <p 
                    className="text-base md:text-lg text-gray-200 font-light leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: insights.playstyles
                        // Bold numbers first (including decimals, percentages, and K/M suffixes)
                        .replace(/\b(\d+(?:\.\d+)?[KM]?%?)\b/g, '<strong class="font-bold text-white text-lg">$1</strong>')
                        // Bold player names
                        .replace(new RegExp(`\\b${player1.name}\\b`, 'g'), `<strong class="font-bold text-orange-300 text-lg">${player1.name}</strong>`)
                        .replace(new RegExp(`\\b${player2.name}\\b`, 'g'), `<strong class="font-bold text-blue-300 text-lg">${player2.name}</strong>`)
                    }}
                  />
                </motion.div>
              )}

              {/* Wild Stats */}
              {insights.funFacts && insights.funFacts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-yellow-500/5 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-7 max-w-4xl mx-auto"
                >
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <span className="text-3xl">✨</span>
                    <h3 className="text-lg font-light text-white uppercase tracking-wider">
                      Wild Stats
                    </h3>
                  </div>
                  <div className="text-base text-gray-200 font-light space-y-3 leading-relaxed">
                    {insights.funFacts.map((fact, index) => (
                      <div 
                        key={index}
                        dangerouslySetInnerHTML={{
                          __html: `• ${fact}`
                            // Bold numbers (including decimals, percentages, and K/M suffixes)
                            .replace(/\b(\d+(?:\.\d+)?[KM]?%?)\b/g, '<strong class="font-bold text-white text-lg">$1</strong>')
                            // Bold player names
                            .replace(new RegExp(`\\b${player1.name}\\b`, 'g'), `<strong class="font-bold text-orange-300 text-lg">${player1.name}</strong>`)
                            .replace(new RegExp(`\\b${player2.name}\\b`, 'g'), `<strong class="font-bold text-blue-300 text-lg">${player2.name}</strong>`)
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Slide 4: The Story & Verdict */}
        {currentSlide === 3 && insights && (
          <motion.div
            key="winner"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: "url('/splash4.png')",
              }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/70" />

            <div className="relative z-10 text-center px-8 max-w-5xl mx-auto">
              {/* Winner Announcement */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <div className="text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-4">
                  The Verdict
                </div>
                <div className={`text-6xl md:text-7xl font-light mb-4 ${
                  insights.winner === "player1"
                    ? "text-blue-400"
                    : insights.winner === "player2"
                      ? "text-purple-400"
                      : "text-gray-300"
                }`}>
                  {insights.winner === "player1"
                    ? player1.name
                    : insights.winner === "player2"
                      ? player2.name
                      : "It's a Tie!"}
                </div>
                <p className="text-lg md:text-xl text-gray-200 font-light leading-relaxed max-w-4xl mx-auto">
                  {insights.verdict}
                </p>
              </motion.div>

              {/* The Story - Remaining Fun Facts */}
              {insights.funFacts && insights.funFacts.length > 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-yellow-500/5 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-5 mb-6"
                >
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-2xl">✨</span>
                    <h3 className="text-base font-light text-white uppercase tracking-wider">
                      The Numbers Tell a Story
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm text-gray-200 font-light leading-relaxed">
                    {insights.funFacts.slice(2).map((fact, index) => (
                      <p 
                        key={index}
                        dangerouslySetInnerHTML={{
                          __html: fact
                            // Bold numbers (including decimals, percentages, and K/M suffixes)
                            .replace(/\b(\d+(?:\.\d+)?[KM]?%?)\b/g, '<strong class="font-bold text-white text-base">$1</strong>')
                            // Bold player names
                            .replace(new RegExp(`\\b${player1.name}\\b`, 'g'), `<strong class="font-bold text-orange-300 text-base">${player1.name}</strong>`)
                            .replace(new RegExp(`\\b${player2.name}\\b`, 'g'), `<strong class="font-bold text-blue-300 text-base">${player2.name}</strong>`)
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Synergy Section */}
              {insights.synergy && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-green-500/5 backdrop-blur-sm border border-green-500/30 rounded-xl p-5 mb-6"
                >
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="text-2xl">🤝</span>
                    <h3 className="text-base font-light text-white uppercase tracking-wider">
                      Duo Queue Potential
                    </h3>
                  </div>
                  <p 
                    className="text-sm text-gray-200 font-light leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: insights.synergy
                        // Bold numbers (including decimals, percentages, and K/M suffixes)
                        .replace(/\b(\d+(?:\.\d+)?[KM]?%?)\b/g, '<strong class="font-bold text-white text-base">$1</strong>')
                        // Bold player names
                        .replace(new RegExp(`\\b${player1.name}\\b`, 'g'), `<strong class="font-bold text-orange-300 text-base">${player1.name}</strong>`)
                        .replace(new RegExp(`\\b${player2.name}\\b`, 'g'), `<strong class="font-bold text-blue-300 text-base">${player2.name}</strong>`)
                    }}
                  />
                </motion.div>
              )}

              {/* The Roast */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-red-500/5 backdrop-blur-sm border border-red-500/30 rounded-xl p-5"
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-2xl">🔥</span>
                  <h3 className="text-base font-light text-white uppercase tracking-wider">
                    The Roast
                  </h3>
                </div>
                <p 
                  className="text-base text-gray-200 font-light italic leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: `"${insights.roast}"`
                      // Bold numbers (including decimals, percentages, and K/M suffixes)
                      .replace(/\b(\d+(?:\.\d+)?[KM]?%?)\b/g, '<strong class="font-bold text-white text-lg">$1</strong>')
                      // Bold player names
                      .replace(new RegExp(`\\b${player1.name}\\b`, 'g'), `<strong class="font-bold text-orange-300 text-lg">${player1.name}</strong>`)
                      .replace(new RegExp(`\\b${player2.name}\\b`, 'g'), `<strong class="font-bold text-blue-300 text-lg">${player2.name}</strong>`)
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-4">
        <button
          onClick={handleTogglePause}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-light transition-all"
        >
          {isPaused ? "▶" : "⏸"}
        </button>
        <div className="flex gap-2">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => handleSlideChange(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentSlide ? "bg-white w-8" : "bg-white/30"
              }`}
            />
          ))}
        </div>
        {currentSlide < totalSlides - 1 && (
          <button
            onClick={handleSkip}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-light transition-all"
          >
            Skip →
          </button>
        )}
      </div>
    </div>
  );
}
