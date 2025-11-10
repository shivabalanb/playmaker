import { motion } from "framer-motion";

interface SeasonSummarySlideProps {
  totalGames: number;
  wins: number;
  winRate: number;
  totalChampions: number;
}

export function SeasonSummarySlide({
  totalGames,
  wins,
  winRate,
  totalChampions,
}: SeasonSummarySlideProps) {
  const stats = [
    {
      label: "Games Played",
      value: totalGames,
      icon: "🏆",
      color: "text-blue-400",
    },
    {
      label: "Victories",
      value: wins,
      icon: "🎯",
      color: "text-green-400",
    },
    {
      label: "Win Rate",
      value: `${(winRate * 100).toFixed(0)}%`,
      icon: "💧",
      color: "text-purple-400",
    },
    {
      label: "Champions",
      value: totalChampions,
      icon: "👑",
      color: "text-yellow-400",
    },
  ];

  return (
    <div className="text-center px-8 max-w-5xl">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold mb-12 text-purple-300"
      >
        Season Chronicle 2025
      </motion.h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.5, rotateY: -90 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: index * 0.15, type: "spring", stiffness: 200 }}
            className="bg-gray-800/50 rounded-lg p-6 backdrop-blur-sm border border-gray-700"
          >
            <div className="text-4xl mb-2">{stat.icon}</div>
            <div className={`text-4xl font-bold mb-2 ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-sm text-gray-400">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
