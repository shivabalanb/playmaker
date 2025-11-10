import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface CorePerformanceSlideProps {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  averageKDA: number;
  killParticipation: number;
  totalGameTime: number;
  averageGameDuration: number;
  totalGoldSpent: number;
  totalDamageDealt: number;
}

export function CorePerformanceSlide({
  totalGames,
  wins,
  losses,
  winRate,
  totalKills,
  totalDeaths,
  totalAssists,
  averageKDA,
  killParticipation,
  totalGameTime,
  averageGameDuration,
  totalGoldSpent,
  totalDamageDealt,
}: CorePerformanceSlideProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const killParticipationPercent = killParticipation
    ? (killParticipation * 100).toFixed(1)
    : null;

  const recordSummary =
    "It’s been a long journey. Let us look back at how far you’ve climbed, each victory and defeat shaping the path ahead.";
  const kdaSummary =
    "KDA doesn’t just measure stats here; it captures your poise in chaos. Let’s see how your fights felt.";

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/splash2.png')",
        }}
      />
      <div className="absolute inset-0 bg-black/80" />
      <BackgroundAnimation variant="stars" intensity="low" />
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-6xl mx-auto">
        

        <div className="w-full max-w-5xl space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <div className="text-center text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-6">
            Your Rift, Your Story
              </div>
            <p className="text-lg md:text-xl text-gray-200 font-light leading-relaxed text-center max-w-3xl mx-auto mb-6">
              {recordSummary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-widest">
                  Wins
                </div>
                <div className="text-5xl font-light text-green-400">{wins}</div>
                <p className="text-xs text-gray-500">
                  Each one pushed the climb forward.
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-widest">
                  Losses
                </div>
                <div className="text-5xl font-light text-red-400">{losses}</div>
                <p className="text-xs text-gray-500">
                  Lessons learned, ready for the next queue.
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-widest">
                  Win Rate
                </div>
                <div className="text-5xl font-light text-green-300">
                  {(winRate * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 text-center"
          >
            <p className="text-base md:text-lg text-gray-300 font-light leading-relaxed max-w-3xl mx-auto mb-6">
              {kdaSummary}
            </p>
            <div className="text-xs text-gray-400 uppercase tracking-[0.4em] mb-3">
              Average KDA
            </div>
            <div className="text-6xl md:text-7xl font-light text-white mb-6">
              {averageKDA.toFixed(2)}
            </div>
            <div className="flex flex-wrap justify-center gap-10 text-sm text-gray-300">
              {killParticipationPercent && (
                <div className="text-center">
                  <div className="text-2xl font-light text-white mb-1">
                    {killParticipationPercent}%
                  </div>
                  <div className="uppercase tracking-widest text-xs text-gray-400">
                    Kill Participation
                  </div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-light text-white mb-1">
                  {formatNumber(totalKills)}
                </div>
                <div className="uppercase tracking-widest text-xs text-gray-400">
                  Total Kills
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-light text-white mb-1">
                  {formatNumber(totalDeaths)}
                </div>
                <div className="uppercase tracking-widest text-xs text-gray-400">
                  Total Deaths
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-light text-white mb-1">
                  {formatNumber(totalAssists)}
                </div>
                <div className="uppercase tracking-widest text-xs text-gray-400">
                  Total Assists
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
