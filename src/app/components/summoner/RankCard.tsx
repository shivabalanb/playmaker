import Image from "next/image";
import { RankData } from "./types";

interface RankCardProps {
  rankData: RankData;
  getRankEmblemUrl: (tier: string) => string;
}

export function RankCard({ rankData, getRankEmblemUrl }: RankCardProps) {
  const winRate = (rankData.wins / (rankData.wins + rankData.losses)) * 100;

  return (
    <div className="backdrop-blur-sm rounded-xl p-6 border border-[#2a3544]/50 shadow-xl min-w-[400px]">
      <div className="flex items-center gap-5">
        {/* Rank Emblem */}
        <div className="shrink-0">
          <Image
            src={getRankEmblemUrl(rankData.tier)}
            alt={rankData.tier}
            width={96}
            height={96}
            className="object-contain drop-shadow-lg"
            unoptimized
          />
        </div>

        {/* Rank Info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
            Ranked Solo
          </div>
          <div className="text-3xl font-bold text-white mb-1 tracking-tight">
            {rankData.tier} {rankData.rank}
          </div>
          <div className="text-base text-gray-300 mb-3 font-medium">
            {rankData.leaguePoints} LP
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white font-semibold">
              {rankData.wins}W {rankData.losses}L
            </span>
            <span
              className={`font-bold text-base ${
                winRate >= 50 ? "text-green-400" : "text-red-400"
              }`}
            >
              {winRate.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
