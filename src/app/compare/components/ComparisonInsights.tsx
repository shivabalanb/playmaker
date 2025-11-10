"use client";

import { motion } from "framer-motion";

interface ComparisonInsightsProps {
  insights: {
    title: string;
    winner: "player1" | "player2" | "tie";
    summary: string;
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
}

export function ComparisonInsights({ insights }: ComparisonInsightsProps) {
  return (
    <div className="space-y-8">
      {/* Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.categories.map((category, index) => (
          <motion.div
            key={category.category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/5 border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{category.emoji}</span>
              <h3 className="text-lg font-light">{category.category}</h3>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              {category.insight.split(/(\b[a-zA-Z0-9_]+\b|\d+\.?\d*%?)/g).map((part, i) => {
                // Check if it's a number (including percentages and decimals)
                if (/^\d+\.?\d*%?$/.test(part)) {
                  return (
                    <span key={i} className="text-white font-bold text-base">
                      {part}
                    </span>
                  );
                }
                // Check if it's a summoner name (contains letters and possibly numbers/underscores)
                // Exclude common words like "vs", "per", "game", "than", "shows", etc.
                const commonWords = ['vs', 'per', 'game', 'than', 'shows', 'superior', 'boasts', 'higher', 'more', 'less', 'wards', 'games', 'rate', 'win', 'perfect', 'consistency'];
                if (/^[a-zA-Z0-9_]+$/.test(part) && !commonWords.includes(part.toLowerCase())) {
                  return (
                    <span key={i} className="text-white font-bold text-base">
                      {part}
                    </span>
                  );
                }
                return <span key={i}>{part}</span>;
              })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Winner:</span>
              <span
                className={`text-sm font-medium ${
                  category.winner === "player1"
                    ? "text-blue-400"
                    : category.winner === "player2"
                      ? "text-purple-400"
                      : "text-gray-400"
                }`}
              >
                {category.winner === "player1"
                  ? "Player 1"
                  : category.winner === "player2"
                    ? "Player 2"
                    : "Tie"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Fun Facts */}
      {insights.funFacts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 rounded-xl p-6"
        >
          <h3 className="text-xl font-light mb-4 flex items-center gap-2">
            <span>✨</span> Fun Facts
          </h3>
          <ul className="space-y-2">
            {insights.funFacts.map((fact, index) => (
              <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                <span className="text-yellow-500 mt-1">•</span>
                <span>
                  {fact.split(/(\b[a-zA-Z0-9_]+\b|\d+\.?\d*%?)/g).map((part, i) => {
                    if (/^\d+\.?\d*%?$/.test(part)) {
                      return (
                        <span key={i} className="text-white font-bold text-base">
                          {part}
                        </span>
                      );
                    }
                    const commonWords = ['vs', 'per', 'game', 'than', 'shows', 'superior', 'boasts', 'higher', 'more', 'less', 'wards', 'games', 'rate', 'win', 'perfect', 'consistency', 'with', 'and', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'as', 'is', 'was', 'are', 'were', 'has', 'have', 'had'];
                    if (/^[a-zA-Z0-9_]+$/.test(part) && !commonWords.includes(part.toLowerCase())) {
                      return (
                        <span key={i} className="text-white font-bold text-base">
                          {part}
                        </span>
                      );
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Roast */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-gradient-to-br from-red-500/10 to-pink-500/5 border border-red-500/30 rounded-xl p-6 text-center"
      >
        <h3 className="text-xl font-light mb-3 flex items-center justify-center gap-2">
          <span>🔥</span> The Roast
        </h3>
        <p className="text-gray-300 italic">
          &quot;
          {insights.roast.split(/(\b[a-zA-Z0-9_]+\b|\d+\.?\d*%?)/g).map((part, i) => {
            if (/^\d+\.?\d*%?$/.test(part)) {
              return (
                <span key={i} className="text-white font-bold text-base not-italic">
                  {part}
                </span>
              );
            }
            const commonWords = ['vs', 'per', 'game', 'than', 'shows', 'superior', 'boasts', 'higher', 'more', 'less', 'wards', 'games', 'rate', 'win', 'perfect', 'consistency', 'with', 'and', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'as', 'is', 'was', 'are', 'were', 'has', 'have', 'had', 'but', 'while', 'your', 'their', 'you', 'they'];
            if (/^[a-zA-Z0-9_]+$/.test(part) && !commonWords.includes(part.toLowerCase())) {
              return (
                <span key={i} className="text-white font-bold text-base not-italic">
                  {part}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
          &quot;
        </p>
      </motion.div>

      {/* Synergy */}
      {insights.synergy && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-green-500/10 to-teal-500/5 border border-green-500/30 rounded-xl p-6"
        >
          <h3 className="text-xl font-light mb-3 flex items-center gap-2">
            <span>🤝</span> Duo Potential
          </h3>
          <p className="text-gray-300">
            {insights.synergy.split(/(\b[a-zA-Z0-9_]+\b|\d+\.?\d*%?)/g).map((part, i) => {
              if (/^\d+\.?\d*%?$/.test(part)) {
                return (
                  <span key={i} className="text-white font-bold text-base">
                    {part}
                  </span>
                );
              }
              const commonWords = ['vs', 'per', 'game', 'than', 'shows', 'superior', 'boasts', 'higher', 'more', 'less', 'wards', 'games', 'rate', 'win', 'perfect', 'consistency', 'with', 'and', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'as', 'is', 'was', 'are', 'were', 'has', 'have', 'had', 'but', 'while', 'your', 'their', 'you', 'they', 'both', 'each', 'this', 'that', 'would', 'could', 'should', 'make', 'duo'];
              if (/^[a-zA-Z0-9_]+$/.test(part) && !commonWords.includes(part.toLowerCase())) {
                return (
                  <span key={i} className="text-white font-bold text-base">
                    {part}
                  </span>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </p>
        </motion.div>
      )}

      {/* Verdict */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-500/30 rounded-xl p-8 text-center"
      >
        <h3 className="text-2xl font-light mb-4">Final Verdict</h3>
        <p className="text-xl text-gray-300">
          {insights.verdict.split(/(\b[a-zA-Z0-9_]+\b|\d+\.?\d*%?)/g).map((part, i) => {
            if (/^\d+\.?\d*%?$/.test(part)) {
              return (
                <span key={i} className="text-white font-bold text-2xl">
                  {part}
                </span>
              );
            }
            const commonWords = ['vs', 'per', 'game', 'than', 'shows', 'superior', 'boasts', 'higher', 'more', 'less', 'wards', 'games', 'rate', 'win', 'perfect', 'consistency', 'with', 'and', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'as', 'is', 'was', 'are', 'were', 'has', 'have', 'had', 'but', 'while', 'your', 'their', 'you', 'they', 'both', 'each', 'this', 'that'];
            if (/^[a-zA-Z0-9_]+$/.test(part) && !commonWords.includes(part.toLowerCase())) {
              return (
                <span key={i} className="text-white font-bold text-2xl">
                  {part}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      </motion.div>
    </div>
  );
}
