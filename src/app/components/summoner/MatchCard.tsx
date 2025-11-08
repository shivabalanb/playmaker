import Image from "next/image";
import { MatchData } from "./types";

interface MatchCardProps {
  match: MatchData;
  puuid: string;
  isMounted: boolean;
  getChampionImageUrl: (championName: string) => string;
  getItemImageUrl: (itemId: number) => string;
  getQueueType: (queueId: number) => string;
  isRankedQueue: (queueId: number) => boolean;
  formatDuration: (seconds: number) => string;
  formatTimeAgo: (timestamp: number) => string;
  reorderItemsWithBootsFirst: (items: number[]) => number[];
}

export function MatchCard({
  match,
  puuid,
  isMounted,
  getChampionImageUrl,
  getItemImageUrl,
  getQueueType,
  isRankedQueue,
  formatDuration,
  formatTimeAgo,
  reorderItemsWithBootsFirst,
}: MatchCardProps) {
  const playerData = match.info.participants.find((p) => p.puuid === puuid);
  if (!playerData) return null;

  const isVictory = playerData.win;
  const kda = `${playerData.kills}/${playerData.deaths}/${playerData.assists}`;
  const cs = playerData.totalMinionsKilled + playerData.neutralMinionsKilled;

  // Separate regular items (0-5) from trinket (6)
  const rawItems = [
    playerData.item0,
    playerData.item1,
    playerData.item2,
    playerData.item3,
    playerData.item4,
    playerData.item5,
  ];
  // Sort items by item ID in descending order (reverse)
  const sortedItems = [...rawItems].sort((a, b) => b - a);
  // Reorder to put boots first if they exist
  const regularItems = reorderItemsWithBootsFirst(sortedItems);
  const trinketItem = playerData.item6;

  return (
    <div
      className={`bg-[#1e2a3a] border-l-4 ${
        isVictory ? "border-green-500" : "border-red-500"
      } rounded-lg p-4 hover:bg-[#22303f] transition-colors`}
    >
      <div className="flex items-center gap-6">
        {/* Champion and Result */}
        <div className="flex items-center gap-4 min-w-[280px]">
          {/* Champion Icon */}
          <div className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-[#3a4a5a] shrink-0">
            <Image
              src={getChampionImageUrl(playerData.championName)}
              alt={playerData.championName}
              width={48}
              height={48}
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="flex flex-col gap-0.5 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-white">
                {playerData.championName}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                  isVictory
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {isVictory ? "VICTORY" : "DEFEAT"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span
                className={
                  isRankedQueue(match.info.queueId)
                    ? "text-gray-300"
                    : "text-gray-500"
                }
              >
                {getQueueType(match.info.queueId)}
              </span>
              <span>•</span>
              <span>{formatDuration(match.info.gameDuration)}</span>
              <span>•</span>
              <span suppressHydrationWarning>
                {isMounted ? formatTimeAgo(match.info.gameCreation) : "..."}
              </span>
            </div>
          </div>
        </div>

        {/* KDA */}
        <div className="flex flex-col items-center min-w-[90px]">
          <div className="text-lg font-bold text-white">{kda}</div>
          <div className="text-xs text-gray-400 whitespace-nowrap">
            {playerData.deaths > 0
              ? (
                  (playerData.kills + playerData.assists) /
                  playerData.deaths
                ).toFixed(2)
              : "Perfect"}{" "}
            KDA
          </div>
        </div>

        {/* Items */}
        <div className="flex items-start gap-1.5 min-w-[110px]">
          {/* Regular Items (6 slots) */}
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              {regularItems.slice(0, 3).map((item, idx) =>
                item > 0 ? (
                  <div
                    key={idx}
                    className="relative w-8 h-8 bg-[#0a0e14] rounded border border-[#3a4a5a] overflow-hidden"
                  >
                    <Image
                      src={getItemImageUrl(item)}
                      alt={`Item ${item}`}
                      width={32}
                      height={32}
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    key={idx}
                    className="w-8 h-8 bg-[#0a0e14] rounded border border-[#2a3a4a]"
                  />
                )
              )}
            </div>
            <div className="flex gap-1">
              {regularItems.slice(3, 6).map((item, idx) =>
                item > 0 ? (
                  <div
                    key={idx + 3}
                    className="relative w-8 h-8 bg-[#0a0e14] rounded border border-[#3a4a5a] overflow-hidden"
                  >
                    <Image
                      src={getItemImageUrl(item)}
                      alt={`Item ${item}`}
                      width={32}
                      height={32}
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    key={idx + 3}
                    className="w-8 h-8 bg-[#0a0e14] rounded border border-[#2a3a4a]"
                  />
                )
              )}
            </div>
          </div>

          {/* Trinket (separate on the right) */}
          <div className="flex flex-col justify-start">
            {trinketItem > 0 ? (
              <div className="relative w-8 h-8 bg-[#0a0e14] rounded border border-[#3a4a5a] overflow-hidden">
                <Image
                  src={getItemImageUrl(trinketItem)}
                  alt={`Trinket ${trinketItem}`}
                  width={32}
                  height={32}
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-8 h-8 bg-[#0a0e14] rounded border border-[#2a3a4a]" />
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-300 ml-auto">
          <div className="text-center">
            <div className="font-semibold">{cs}</div>
            <div className="text-gray-500">CS</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">
              {(playerData.goldEarned / 1000).toFixed(1)}k
            </div>
            <div className="text-gray-500">Gold</div>
          </div>
        </div>

        {/* Review Button */}
        <button className= "cursor-pointer px-3 py-1.5 bg-black hover:bg-gray-900 text-white text-xs rounded transition-colors whitespace-nowrap">
          Review
        </button>
      </div>
    </div>
  );
}

