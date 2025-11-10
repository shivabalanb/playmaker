"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface FinalSlideProps {
  puuid: string | null;
  region: string | null;
  recapData?: RecapData;
}

interface Stat {
  label: string;
  value: number;
}

interface RecapData {
  stats?: RecapStats;
}

interface RecapStats {
  corePerformance?: {
    totalKills?: number;
    totalDeaths?: number;
    totalAssists?: number;
    averageKDA?: number;
    totalDamageToChampions?: number;
    averageDamagePerGame?: number;
    totalGoldEarned?: number;
    averageGoldPerMinute?: number;
    totalBountyGold?: number;
  };
  vision?: {
    totalVisionScore?: number;
    totalWardsPlaced?: number;
    totalWardsDestroyed?: number;
    totalControlWardsPlaced?: number;
  };
  objectives?: {
    totalDragonTakedowns?: number;
    totalBaronTakedowns?: number;
    totalTurretTakedowns?: number;
    epicMonsterSteals?: number;
    riftHeraldTakedowns?: number;
  };
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
  clutchMoments?: {
    outnumberedKills?: number;
    killsUnderOwnTurret?: number;
    savesAllyFromDeath?: number;
    survivedThreeImmobilizes?: number;
  };
  communication?: {
    totalPings?: number;
    averagePingsPerGame?: number;
  };
}

export function FinalSlide({ puuid, region, recapData }: FinalSlideProps) {
  const router = useRouter();
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [leftStat, setLeftStat] = useState<Stat | null>(null);
  const [rightStat, setRightStat] = useState<Stat | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Extract all available stats from recapData
  const availableStats = useMemo(() => {
    if (!recapData?.stats) return [];
    const stats: Array<{ label: string; value: number }> = [];
    const s = recapData.stats;

    // Core Performance
    if (s.corePerformance) {
      const cp = s.corePerformance;
      if (cp.totalKills)
        stats.push({ label: "Total Kills", value: cp.totalKills });
      if (cp.totalDeaths)
        stats.push({ label: "Total Deaths", value: cp.totalDeaths });
      if (cp.totalAssists)
        stats.push({ label: "Total Assists", value: cp.totalAssists });
      if (cp.averageKDA)
        stats.push({ label: "Average KDA", value: cp.averageKDA });
      if (cp.totalDamageToChampions)
        stats.push({ label: "Total Damage", value: cp.totalDamageToChampions });
      if (cp.averageDamagePerGame)
        stats.push({
          label: "Avg Damage/Game",
          value: cp.averageDamagePerGame,
        });
      if (cp.totalGoldEarned)
        stats.push({ label: "Total Gold Earned", value: cp.totalGoldEarned });
      if (cp.averageGoldPerMinute)
        stats.push({
          label: "Gold Per Minute",
          value: cp.averageGoldPerMinute,
        });
      if (cp.totalBountyGold)
        stats.push({ label: "Bounty Gold", value: cp.totalBountyGold });
    }

    // Vision
    if (s.vision) {
      const v = s.vision;
      if (v.totalVisionScore)
        stats.push({ label: "Total Vision Score", value: v.totalVisionScore });
      if (v.totalWardsPlaced)
        stats.push({ label: "Wards Placed", value: v.totalWardsPlaced });
      if (v.totalWardsDestroyed)
        stats.push({ label: "Wards Destroyed", value: v.totalWardsDestroyed });
      if (v.totalControlWardsPlaced)
        stats.push({
          label: "Control Wards",
          value: v.totalControlWardsPlaced,
        });
    }

    // Objectives
    if (s.objectives) {
      const o = s.objectives;
      if (o.totalDragonTakedowns)
        stats.push({ label: "Dragons", value: o.totalDragonTakedowns });
      if (o.totalBaronTakedowns)
        stats.push({ label: "Barons", value: o.totalBaronTakedowns });
      if (o.totalTurretTakedowns)
        stats.push({ label: "Turrets", value: o.totalTurretTakedowns });
      if (o.epicMonsterSteals)
        stats.push({ label: "Epic Steals", value: o.epicMonsterSteals });
      if (o.riftHeraldTakedowns)
        stats.push({ label: "Rift Heralds", value: o.riftHeraldTakedowns });
    }

    // Achievements
    if (s.achievements) {
      const a = s.achievements;
      if (a.pentakills)
        stats.push({ label: "Pentakills", value: a.pentakills });
      if (a.quadrakills)
        stats.push({ label: "Quadrakills", value: a.quadrakills });
      if (a.tripleKills)
        stats.push({ label: "Triple Kills", value: a.tripleKills });
      if (a.soloKills) stats.push({ label: "Solo Kills", value: a.soloKills });
      if (a.firstBloods)
        stats.push({ label: "First Bloods", value: a.firstBloods });
      if (a.perfectGames)
        stats.push({ label: "Perfect Games", value: a.perfectGames });
      if (a.flawlessAces)
        stats.push({ label: "Flawless Aces", value: a.flawlessAces });
      if (a.epicMonsterSteals)
        stats.push({ label: "Epic Steals", value: a.epicMonsterSteals });
    }

    // Clutch Moments
    if (s.clutchMoments) {
      const cm = s.clutchMoments;
      if (cm.outnumberedKills)
        stats.push({ label: "Outnumbered Kills", value: cm.outnumberedKills });
      if (cm.killsUnderOwnTurret)
        stats.push({ label: "Turret Kills", value: cm.killsUnderOwnTurret });
      if (cm.savesAllyFromDeath)
        stats.push({ label: "Ally Saves", value: cm.savesAllyFromDeath });
      if (cm.survivedThreeImmobilizes)
        stats.push({ label: "CC Escapes", value: cm.survivedThreeImmobilizes });
    }

    // Communication
    if (s.communication) {
      const comm = s.communication;
      if (comm.totalPings)
        stats.push({ label: "Total Pings", value: comm.totalPings });
      if (comm.averagePingsPerGame)
        stats.push({
          label: "Pings Per Game",
          value: comm.averagePingsPerGame,
        });
    }

    return stats.filter((stat) => stat.value > 0);
  }, [recapData]);

  // Calculate difficulty range based on round (smaller range = harder)
  const getDifficultyRange = (round: number) => {
    // Start with 50% range, decrease to 10% by round 10
    const maxRange = 0.5;
    const minRange = 0.1;
    const range = maxRange - ((maxRange - minRange) * round) / 9;
    return Math.max(minRange, range);
  };

  const generateRightStat = useCallback(
    (leftValue: number, round: number) => {
      if (availableStats.length < 2) return null;

      const range = getDifficultyRange(round);
      const minDiff = leftValue * range;

      const candidates = availableStats.filter((stat) => {
        const diff = Math.abs(stat.value - leftValue);
        return diff >= minDiff && stat.value !== leftValue;
      });

      if (candidates.length === 0) {
        const different = availableStats.filter((s) => s.value !== leftValue);
        return different.length > 0
          ? different[Math.floor(Math.random() * different.length)]
          : null;
      }

      return candidates[Math.floor(Math.random() * candidates.length)];
    },
    [availableStats]
  );

  const startGame = useCallback(() => {
    if (availableStats.length < 2) return;

    setCurrentRound(0);
    setScore(0);
    setGameOver(false);
    setRevealed(false);

    const shuffled = [...availableStats].sort(() => Math.random() - 0.5);
    const startStat = shuffled[0];
    setLeftStat(startStat);

    const right = generateRightStat(startStat.value, 0);
    setRightStat(right);
  }, [availableStats, generateRightStat]);

  const handleGuess = (isHigher: boolean) => {
    if (!leftStat || !rightStat || revealed) return;

    console.log(leftStat.value, rightStat.value);

    const correct = isHigher
      ? rightStat.value > leftStat.value
      : rightStat.value < leftStat.value;

    setRevealed(true);
    if (correct) {
      setScore((prev) => prev + 1);
    }

    setTimeout(() => {
      if (currentRound < 9) {
        // Right stat becomes left stat (chaining)
        setLeftStat(rightStat);
        setRevealed(false);
        setCurrentRound((prev) => prev + 1);

        // Generate new right stat with increased difficulty
        const newRight = generateRightStat(rightStat.value, currentRound + 1);
        setRightStat(newRight);
      } else {
        setGameOver(true);
      }
    }, 2000);
  };

  // Initialize game on mount
  useEffect(() => {
    if (availableStats.length >= 2) {
      const timer = window.setTimeout(() => {
        startGame();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [availableStats, startGame]);

  const handleBackToProfile = () => {
    if (puuid && region) {
      router.push(
        `/summoner/profile?puuid=${encodeURIComponent(puuid)}&region=${region}`
      );
    } else {
      router.push("/");
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/splash11.png')" }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <BackgroundAnimation variant="stars" intensity="high" />

      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, -80, 0],
            y: [0, 60, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 text-center px-8 max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="flex flex-col items-center"
        >
          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="text-[10rem] md:text-[14rem] font-medium tracking-tight leading-none text-white"
          >
            END
          </motion.h1>

          <div className="text-center text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-3">
            start of a new beginning
          </div>

          <div className="w-full h-px bg-white/10 max-w-2xl mb-8" />

          {/* Game Display */}
          {!gameOver && leftStat && rightStat && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.8,
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="w-full max-w-2xl mb-8"
            >
              <div className="text-center mb-6">
                <div className="text-xs text-gray-400 uppercase tracking-[0.3em] mb-2">
                  Higher or Lower
                </div>
                <p className="text-sm text-gray-400">
                  Round {currentRound + 1}/10 • Score: {score}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-start">
                {/* Left Stat */}
                <motion.div
                  key={leftStat.label}
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className="rounded-xl p-5 text-center border border-orange-400/30 bg-orange-500/15 backdrop-blur-sm shadow-lg"
                >
                  <div className="text-xs text-gray-200/80 mb-2 font-light uppercase tracking-wider">
                    {leftStat.label}
                  </div>
                  <div className="text-3xl font-light text-white">
                    {formatNumber(leftStat.value)}
                  </div>
                </motion.div>

                {/* Right Stat */}
                <motion.div
                  initial={{ x: 20 }}
                  animate={{ x: 0 }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className="rounded-xl p-5 text-center border border-blue-400/30 bg-blue-500/15 backdrop-blur-sm shadow-lg relative md:col-start-2"
                >
                  <div className="text-xs text-gray-200/80 mb-2 font-light uppercase tracking-wider">
                    {rightStat.label}
                  </div>
                  <AnimatePresence mode="wait">
                    {!revealed ? (
                      <motion.div
                        key="hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-3xl font-light text-gray-600"
                      >
                        ?
                      </motion.div>
                    ) : (
                      <motion.div
                        key="revealed"
                        initial={{ opacity: 0, scale: 0.5, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={`text-3xl font-light ${
                          rightStat.value > leftStat.value
                            ? "text-green-400"
                            : rightStat.value < leftStat.value
                              ? "text-red-400"
                              : "text-white"
                        }`}
                      >
                        {formatNumber(rightStat.value)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <div className="md:col-start-2 md:row-start-2 flex flex-col gap-2 justify-center w-full ">
                  {!revealed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3 justify-center"
                    >
                      <button
                        onClick={() => handleGuess(true)}
                        className=" w-full px-6 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-sm font-light text-white transition-all"
                      >
                        Higher
                      </button>
                      <button
                        onClick={() => handleGuess(false)}
                        className="w-full px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-sm font-light text-white transition-all"
                      >
                        Lower
                      </button>
                    </motion.div>
                  )}
                  
                </div>
              </div>
            </motion.div>
          )}

          {/* Game Over */}
          {gameOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8"
            >
              <p className="text-xl text-gray-300 mb-4">
                Game Over! Final Score: {score}/10
              </p>
              <button
                onClick={startGame}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-light text-white transition-all"
              >
                Play Again
              </button>
            </motion.div>
          )}

          {/* Epic button */}
          <motion.button
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBackToProfile}
            className="relative px-2 py-2 text-lg font-light rounded-lg tracking-wider text-white  bg-black/50 border border-white/20 shadow-lg backdrop-blur-sm overflow-hidden group"
          >
            <span className=" text-sm relative z-10">
              Back to Profile
            </span>
            <motion.div
              className="absolute inset-0 "
              initial={{ x: "-100%" }}
              whileHover={{ x: "100%" }}
              transition={{ duration: 0.6 }}
            />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
