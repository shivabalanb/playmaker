"use client";

import { motion } from "framer-motion";

interface StatComparisonProps {
  player1: any;
  player2: any;
  player1Name?: string;
  player2Name?: string;
}

export function StatComparison({ player1, player2, player1Name = "Player 1", player2Name = "Player 2" }: StatComparisonProps) {
  const stats1 = player1?.stats || {};
  const stats2 = player2?.stats || {};

  const comparisons = [
    {
      label: "Win Rate",
      value1: stats1.corePerformance?.winRate || 0,
      value2: stats2.corePerformance?.winRate || 0,
      format: (v: number) => `${v.toFixed(1)}%`,
      higherIsBetter: true,
    },
    {
      label: "Average KDA",
      value1: stats1.corePerformance?.averageKDA || 0,
      value2: stats2.corePerformance?.averageKDA || 0,
      format: (v: number) => v.toFixed(2),
      higherIsBetter: true,
    },
    {
      label: "Total Games",
      value1: stats1.corePerformance?.totalGames || 0,
      value2: stats2.corePerformance?.totalGames || 0,
      format: (v: number) => v.toString(),
      higherIsBetter: true,
    },
    {
      label: "Avg Damage/Game",
      value1: stats1.corePerformance?.averageDamagePerGame || 0,
      value2: stats2.corePerformance?.averageDamagePerGame || 0,
      format: (v: number) => v.toLocaleString(),
      higherIsBetter: true,
    },
    {
      label: "Gold Per Minute",
      value1: stats1.corePerformance?.averageGoldPerMinute || 0,
      value2: stats2.corePerformance?.averageGoldPerMinute || 0,
      format: (v: number) => v.toFixed(0),
      higherIsBetter: true,
    },
    {
      label: "Kill Participation",
      value1: stats1.corePerformance?.killParticipation || 0,
      value2: stats2.corePerformance?.killParticipation || 0,
      format: (v: number) => `${v.toFixed(1)}%`,
      higherIsBetter: true,
    },
    {
      label: "Vision Score/Game",
      value1: stats1.vision?.averageVisionScore || 0,
      value2: stats2.vision?.averageVisionScore || 0,
      format: (v: number) => v.toFixed(1),
      higherIsBetter: true,
    },
    {
      label: "Total Dragons",
      value1: stats1.objectives?.totalDragonTakedowns || 0,
      value2: stats2.objectives?.totalDragonTakedowns || 0,
      format: (v: number) => v.toString(),
      higherIsBetter: true,
    },
    {
      label: "Total Barons",
      value1: stats1.objectives?.totalBaronTakedowns || 0,
      value2: stats2.objectives?.totalBaronTakedowns || 0,
      format: (v: number) => v.toString(),
      higherIsBetter: true,
    },
    {
      label: "Pentakills",
      value1: stats1.achievements?.pentakills || 0,
      value2: stats2.achievements?.pentakills || 0,
      format: (v: number) => v.toString(),
      higherIsBetter: true,
    },
  ];

  return (
    <div className="space-y-4">
      {comparisons.map((stat, index) => {
        const winner =
          stat.value1 > stat.value2 ? "player1" : stat.value1 < stat.value2 ? "player2" : "tie";
        const diff = Math.abs(stat.value1 - stat.value2);
        const diffPercent =
          stat.value2 !== 0 ? ((diff / Math.max(stat.value1, stat.value2)) * 100).toFixed(1) : "0";

        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white/5 border border-white/10 rounded-lg p-4"
          >
            <div className="text-center text-sm text-gray-400 mb-3 uppercase tracking-wider">
              {stat.label}
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Player 1 */}
              <div
                className={`text-right text-2xl font-light ${
                  winner === "player1" ? "text-green-400" : winner === "tie" ? "text-white" : "text-gray-500"
                }`}
              >
                {stat.format(stat.value1)}
                {winner === "player1" && <span className="ml-2 text-sm">👑</span>}
              </div>

              {/* Difference */}
              <div className="text-center text-xs text-gray-500">
                {winner !== "tie" && `${diffPercent}% diff`}
              </div>

              {/* Player 2 */}
              <div
                className={`text-left text-2xl font-light ${
                  winner === "player2" ? "text-green-400" : winner === "tie" ? "text-white" : "text-gray-500"
                }`}
              >
                {winner === "player2" && <span className="mr-2 text-sm">👑</span>}
                {stat.format(stat.value2)}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
