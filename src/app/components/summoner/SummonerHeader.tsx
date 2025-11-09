import Link from "next/link";
import Image from "next/image";
import { SummonerData, RankData } from "./types";
import { ProfileHeader } from "./ProfileHeader";
import { RankCard } from "./RankCard";
import { UnrankedCard } from "./UnrankedCard";
import { getChampionSplashUrl } from "@/lib";

interface SummonerHeaderProps {
  summonerData: SummonerData | null;
  summonerName: string;
  rankData: RankData | null;
  featuredChampion: string | null;
  getProfileIconUrl: (iconId: number) => string;
  getRankEmblemUrl: (tier: string) => string;
}

export function SummonerHeader({
  summonerData,
  summonerName,
  rankData,
  featuredChampion,
  getProfileIconUrl,
  getRankEmblemUrl,
}: SummonerHeaderProps) {
  const splashUrl = featuredChampion
    ? getChampionSplashUrl(featuredChampion)
    : null;

  return (
    <header className="relative py-16 border-b border-[#2a3a4a] overflow-hidden ">
      {/* Champion Splash Art Background */}
      {featuredChampion && splashUrl && (
        <div className="absolute inset-0 z-0">
          <Image
            src={splashUrl}
            alt={`${featuredChampion} splash art`}
            fill
            className="object-cover object-[50%_20%]"
            priority
            unoptimized
            onError={(e) => {
              console.error("Failed to load splash art:", splashUrl);
              console.error("Error:", e);
            }}
          />
          {/* Dark overlay for readability - reduced opacity to show more of splash art */}
          <div className="absolute inset-0 bg-linear-to-b from-[#0a1428]/80 via-[#1a2332]/75 to-[#0f1923]/80" />
        </div>
      )}

      {/* Fallback gradient background if no champion */}
      {/* {!featuredChampion && (
        <div className="absolute inset-0 bg-linear-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923] -z-10" />
      )} */}

      {/* Back Button - Absolute Top Left of Screen */}
      <Link
        href="/"
        className="fixed top-4 left-4 w-10 h-10 rounded-full bg-black/80 hover:bg-black flex items-center justify-center transition-colors border border-[#2a3544]/50 z-50"
        aria-label="Back to Search"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        {/* Main Header Content - Combined Layout */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
          {/* Left: Profile Section */}
          <div className="flex-1 w-full">
            <ProfileHeader
              summonerData={summonerData}
              summonerName={summonerName}
              getProfileIconUrl={getProfileIconUrl}
            />
          </div>

          {/* Right: Rank Card or Unranked Card */}
          {rankData ? (
            <div>
              <RankCard
                rankData={rankData}
                getRankEmblemUrl={getRankEmblemUrl}
              />
            </div>
          ) : (
            <div>
              <UnrankedCard />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
