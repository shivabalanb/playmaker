import Image from "next/image";
import { SummonerData } from "./types";

interface ProfileHeaderProps {
  summonerData: SummonerData | null;
  summonerName: string;
  getProfileIconUrl: (iconId: number) => string;
}

export function ProfileHeader({
  summonerData,
  summonerName,
  getProfileIconUrl,
}: ProfileHeaderProps) {
  return (
        <div className="flex items-center gap-6">
          {summonerData && (
        <div className="relative inline-block shrink-0">
          <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-[#3a4a5a] shadow-2xl bg-[#1a2332]">
                <Image
                  src={getProfileIconUrl(summonerData.profileIconId)}
                  alt="Profile Icon"
              width={128}
              height={128}
                  className="object-cover"
                  unoptimized
                />
              </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black rounded-lg w-12 h-8 flex items-center justify-center border-2 border-[#0f1923] shadow-lg">
                <span className="text-xs font-bold text-white">
                  {summonerData.summonerLevel}
                </span>
              </div>
            </div>
          )}
      <div className="min-w-0">
        <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
          {summonerName}
        </h1>
      </div>
    </div>
  );
}
