import { motion } from "framer-motion";
// no image imports needed for this slide
import { BackgroundAnimation } from "./BackgroundAnimation";

interface CorePerformanceEconomySlideProps {
  totalDamageToChampions: number;
  averageDamagePerGame: number;
  totalGoldEarned: number;
  averageGoldPerMinute: number;
  totalBountyGold: number;
  // Moved section from CorePerformanceSlide
  averageGameDuration: number;
  totalGameTime: number;
  mostActiveHour?: number;
}

export function CorePerformanceEconomySlide({
  totalDamageToChampions,
  averageDamagePerGame,
  totalGoldEarned,
  averageGoldPerMinute,
  totalBountyGold,
  averageGameDuration,
  totalGameTime,
  mostActiveHour,
}: CorePerformanceEconomySlideProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return "0m";
    const mins = Math.round(seconds / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatHour = (h?: number) => {
    if (h === undefined || h === null || Number.isNaN(h)) return "—";
    const hour = ((h % 24) + 24) % 24;
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12} ${suffix}`;
  };
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/splash3.png')",
        }}
      />
      <div className="absolute inset-0 bg-black/80" />
      <BackgroundAnimation variant="stars" intensity="low" />
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-6xl mx-auto">
        <div className="w-full max-w-5xl space-y-4">
          {/* Lead-in sentence for the economy and damage context */}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <div className="text-center text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-6">
              Force and Fortune
            </div>
            <p className="mb-6">
              {" "}
              Your impact wasn’t just felt — it was funded. Here’s how your
              damage and economy shaped every fight.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
              {/* Damage (left) */}
              <div className="flex items-start gap-4">
                <div className="min-w-0">
                  <div className="flex gap-6" >
                    <div >
                      <div className="text-sm text-gray-400 font-light tracking-wider uppercase mb-2">
                        Total Damage
                      </div>
                      <div className="text-5xl font-light text-red-400">
                        {formatNumber(totalDamageToChampions)}
                      </div>
                    </div>
                    <div className="text-7xl">⚔️</div>
                    <div></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 max-w-md">
                    Cumulative damage dealt to enemy champions across all games.
                  </p>
                  <div className="mt-4 text-sm text-gray-300">
                    Average damage dealt per game:{" "}
                    <span className="font-light text-white text-xl">
                      {formatNumber(averageDamagePerGame)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gold (right) */}
              <div className="flex items-start gap-4 md:justify-end">
                <div className="text-right min-w-0">
                <div className="flex   justify-end " >
                                      <div className="text-7xl">💰</div>
                <div  className="">
                  <div className="text-sm text-right ml-6  text-gray-400 font-light tracking-wider uppercase mb-2">
                    Gold Earned
                  </div>
                  <div className="text-5xl font-light text-yellow-400">
                    {formatNumber(totalGoldEarned)}
                  </div>
                  </div>
                  <div></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Total gold accumulated from all sources (CS, kills, assists,
                    objectives).
                  </p>
                  <div className="mt-4 flex items-center justify-end gap-6 text-sm">
                    <div className="text-gray-300">
                      Gold per minute{" "}
                      <span className="font-light text-white text-xl">
                        {averageGoldPerMinute.toFixed(0)}
                      </span>
                    </div>
                    {totalBountyGold > 0 && (
                      <>
                        <div className="w-px bg-white/20 h-5" />
                        <div className="text-gray-300">
                          Total bounty gold{" "}
                          <span className=" text-xl font-light text-purple-300">
                            {formatNumber(totalBountyGold)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tempo and pacing */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <p className=" text-white mb-6">
              Time well spent (queue timers not included), here&apos;s how it
              all adds up.
            </p>
            <div className="grid grid-cols-3 gap-8 text-center items-end">
              {/* Avg Game Length */}
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-widest">
                  Avg Game
                </div>
                <div className="text-2xl font-light text-white">
                  {formatDuration(averageGameDuration)}
                </div>
              </div>
              {/* Time Played (center, bigger) */}
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-widest">
                  Time Played
                </div>
                <div className="text-4xl md:text-5xl font-light text-white">
                  {formatDuration(totalGameTime)}
                </div>
              </div>

              {/* Most Active Hour */}
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-widest">
                  Most Active Time
                </div>
                <div className="text-2xl font-light text-white">
                  {formatHour(mostActiveHour)}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
