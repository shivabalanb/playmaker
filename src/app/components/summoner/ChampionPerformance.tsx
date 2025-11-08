import Image from "next/image";
import { ChampionStats } from "./types";

interface ChampionPerformanceProps {
  championStats: Map<string, ChampionStats>;
  getChampionImageUrl: (championName: string) => string;
}

export function ChampionPerformance({
  championStats,
  getChampionImageUrl,
}: ChampionPerformanceProps) {
  if (championStats.size === 0) return null;

  return (
    <aside className="lg:w-80 shrink-0">
      <div className="bg-[#1e2a3a] rounded-xl p-5 border border-[#2a3a4a] sticky top-4">
        <h3 className="text-lg font-bold text-white mb-4">
          Champion Performance
        </h3>
        <div className="space-y-2">
          {Array.from(championStats.entries())
            .sort((a, b) => b[1].games - a[1].games)
            .slice(0, 5)
            .map(([champion, stats]) => {
              const kda =
                stats.deaths > 0
                  ? ((stats.kills + stats.assists) / stats.deaths).toFixed(1)
                  : "Perfect";
              const winrate = ((stats.wins / stats.games) * 100).toFixed(0);

              return (
                <div
                  key={champion}
                  className="flex items-center justify-between p-3 bg-[#2a3544] rounded-lg hover:bg-[#354252] transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-[#3a4a5a] shrink-0">
                      <Image
                        src={getChampionImageUrl(champion)}
                        alt={champion}
                        width={40}
                        height={40}
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">
                        {champion}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(stats.kills / stats.games).toFixed(1)} /{" "}
                        {(stats.deaths / stats.games).toFixed(1)} /{" "}
                        {(stats.assists / stats.games).toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-sm font-bold text-white">{kda}</div>
                    <div className="text-xs text-gray-400">
                      {winrate}% ({stats.games}G)
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </aside>
  );
}

