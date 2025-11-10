"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { getChampionSplashUrl, getChampionImageUrl } from "@/lib/riot/assets";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface ChampionData {
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
  // Additional fields for calculations
  totalKills?: number;
  totalDeaths?: number;
  totalAssists?: number;
  totalGameTime?: number;
  // Damage taken would need to be added to handler
  totalDamageTaken?: number;
}

interface RoleData {
  role: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKDA: number;
}

interface ChampionRoleStatsSlideProps {
  favoriteChampion?: ChampionData;
  top5Champions?: ChampionData[];
  favoriteRole?: {
    role: string;
  };
  roleDistribution?: RoleData[];
  allChampions?: ChampionData[];
  totalUniqueChampions?: number;
}

interface HighlightCardProps {
  title: string;
  champion: string;
  value: string;
}

export function ChampionRoleStatsSlide({
  top5Champions,
  roleDistribution,
  allChampions = [],
  totalUniqueChampions = 0,
}: ChampionRoleStatsSlideProps) {
  const champions = useMemo(
    () => (allChampions.length > 0 ? allChampions : top5Champions || []),
    [allChampions, top5Champions]
  );
  const totalChampions = totalUniqueChampions || champions.length;

  const sortedChampions = useMemo(() => {
    // Rank by win rate with a light minimum games filter to avoid outliers
    const minGames = 3;
    const pool =
      champions.filter((c) => (c.gamesPlayed || 0) >= minGames) || champions;
    return [...pool].sort((a, b) => {
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate;
      }
      // tiebreaker: more games first
      return b.gamesPlayed - a.gamesPlayed;
    });
  }, [champions]);

  const roleSummaries = useMemo(() => {
    if (!roleDistribution) return [];
    return roleDistribution
      .filter((role) => role.role !== "" && role.role !== "UNKNOWN")
      .sort((a, b) => b.games - a.games);
  }, [roleDistribution]);

  // Extra highlights on the champions side
  const mostDamageChampion = useMemo(() => {
    if (champions.length === 0) return null;
    return [...champions].sort(
      (a, b) => (b.averageDamage || 0) - (a.averageDamage || 0)
    )[0];
  }, [champions]);

  const mostKillsChampion = useMemo(() => {
    const withTotals = champions.filter(
      (c) => typeof c.totalKills === "number"
    );
    if (withTotals.length === 0) return null;
    return [...withTotals].sort((a, b) => b.totalKills! - a.totalKills!)[0];
  }, [champions]);

  const mostAssistsChampion = useMemo(() => {
    const withTotals = champions.filter(
      (c) => typeof c.totalAssists === "number"
    );
    if (withTotals.length === 0) return null;
    return [...withTotals].sort((a, b) => b.totalAssists! - a.totalAssists!)[0];
  }, [champions]);
  const mostDeathsChampion = useMemo(() => {
    const withTotals = champions.filter(
      (c) => typeof c.totalDeaths === "number"
    );
    if (withTotals.length === 0) return null;
    return [...withTotals].sort((a, b) => b.totalDeaths! - a.totalDeaths!)[0];
  }, [champions]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const rankThemes = [
    {
      background: "rgba(250,204,21,0.18)",
      badgeColor: "#facc15",
      badgeText: "#1f2937",
      accent: "#facc15",
    },
    {
      background: "rgba(209,213,219,0.2)",
      badgeColor: "#e5e7eb",
      badgeText: "#111827",
      accent: "#e5e7eb",
    },
    {
      background: "rgba(217,119,6,0.18)",
      badgeColor: "#f59e0b",
      badgeText: "#1f2937",
      accent: "#f59e0b",
    },
  ];

  const defaultTheme = {
    background: "#000",
    badgeColor: "#000",
    badgeText: "#e5e7eb",
    accent: "#e5e7eb",
  };

  const highlightCards = useMemo(() => {
    const cards: HighlightCardProps[] = [];

    if (mostDamageChampion) {
      cards.push({
        title: "Most Avg Damage",
        champion: mostDamageChampion.champion,
        value: `${formatNumber(Math.round(mostDamageChampion.averageDamage))} dmg`,
      });
    }
    if (mostKillsChampion) {
      cards.push({
        title: "Most Kills ",
        champion: mostKillsChampion.champion,
        value: `${formatNumber(mostKillsChampion.totalKills!)} kills`,
      });
    }
    if (mostAssistsChampion) {
      cards.push({
        title: "Most Assists",
        champion: mostAssistsChampion.champion,
        value: `${formatNumber(mostAssistsChampion.totalAssists!)} assists`,
      });
    }
    if (mostDeathsChampion) {
      cards.push({
        title: "Most Deaths",
        champion: mostDeathsChampion.champion,
        value: `${formatNumber(mostDeathsChampion.totalDeaths!)} deaths`,
      });
    }

    return cards;
  }, [
    mostDamageChampion,
    mostKillsChampion,
    mostAssistsChampion,
    mostDeathsChampion,
  ]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/splash6.png')" }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <BackgroundAnimation variant="stars" intensity="low" />
      <div className="relative z-10 flex items-center justify-center px-8 max-w-7xl mx-auto w-full h-full">
        <div className="grid grid-cols-[400px_1fr] gap-12 w-full h-full py-12">
          {/* Left Panel - Roles */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col space-y-8 mt-12"
          >
            {/* Summary Text */}
            <div className="text-white space-y-4">
              <div className="text-center text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-6">
            Finding Your Place
              </div>
              <p className="text-lg font-light leading-relaxed">
                You have played{" "}
                <span className="font-medium bg-yellow-200 text-black">
                  {totalChampions} different champions
                </span>
                . Let&apos;s see which ones were your favorites.
              </p>
            </div>

            {roleSummaries.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-400 font-light tracking-wider uppercase">
                  Role Breakdown
                </div>
                <div className="space-y-2">
                  {roleSummaries.slice(0, 5).map((role) => (
                    <div
                      key={role.role}
                      className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-6 h-6 shrink-0">
                          <Image
                            src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${role.role.toLowerCase() === "mid" ? "middle" : role.role.toLowerCase()}.png`}
                            alt={role.role}
                            fill
                            className="object-contain"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">
                            {role.role}
                          </span>
                          <span className="text-xs text-gray-400">
                            {role.games} games{" "}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        {(role.winRate * 100).toFixed(1)}% WR
                        <span className="text-sm font-light text-gray-300">
                          Avg KDA {role.avgKDA.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Right Panel - Champions + Highlights */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="overflow-y-auto mt-12"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ">
              {sortedChampions.slice(0, 5).map((champ, index) => {
                const theme = rankThemes[index] ?? defaultTheme;
                const primaryLine = `${champ.gamesPlayed} games • ${(
                  champ.winRate * 100
                ).toFixed(0)}% WR`;
                const secondaryLine = `KDA ${champ.averageKDA.toFixed(
                  2
                )} • ${formatNumber(Math.round(champ.averageDamage))} dmg`;

                return (
                  <motion.div
                    key={champ.champion}
                    initial={{ scale: 0.95, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative group p-4"
                  >
                    {/* Number Badge */}
                    <div
                      className="absolute left-4 py-2 px-2 -full  font-semibold tracking-wider z-20"
                      style={{
                        background: theme.badgeColor,
                        color: theme.badgeText,
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Champion Card */}
                    <div
                      className="relative rounded-2xl overflow-hidden backdrop-blur-md transition-all duration-500 cursor-pointer "
                      style={{ background: theme.background }}
                    >
                      <div className="absolute inset-0 bg-black/30" />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" />
                      {/* Champion Splash Art */}
                      <div className="relative w-full h-32 overflow-hidden">
                        <Image
                          src={getChampionSplashUrl(champ.champion)}
                          alt={champ.champion}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 25vw"
                        />
                        {/* Gradient overlay for better text readability */}
                        {/* <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" /> */}
                      </div>

                      {/* Champion Name and Stat */}
                      <div className="relative p-4">
                        <div className="text-lg font-medium text-white mb-1 truncate tracking-wide">
                          {champ.champion}
                        </div>
                        <div
                          className="text-xs font-semibold uppercase tracking-wider"
                          style={{ color: theme.accent }}
                        >
                          {primaryLine}
                        </div>
                        <div className="text-[11px] text-gray-200/80 mt-1">
                          {secondaryLine}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {highlightCards.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-8">
                {highlightCards.map((card) => (
                  <HighlightCard
                    key={card.title}
                    title={card.title}
                    champion={card.champion}
                    value={card.value}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function formatChampionKey(name: string): string {
  const cleaned = name.replace(/[^A-Za-z]/g, "");
  if (!cleaned) {
    return name;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function HighlightCard({ title, champion, value }: HighlightCardProps) {
  const championKey = formatChampionKey(champion);

  return (
    <div className="bg-black rounded-xl p-4 border border-white/10">
      <div className="text-sm  text-white uppercase tracking-wider mb-2">
        {title}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10  overflow-hidden bg-black/30">
            <Image
              src={getChampionImageUrl(championKey)}
              alt={champion}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <div className="text-sm text-gray-300 font-medium truncate">
              {champion}
            </div>
            <div className="text-lg text-white shrink-0">{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
