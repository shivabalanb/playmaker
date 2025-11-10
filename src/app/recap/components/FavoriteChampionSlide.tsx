import { motion } from "framer-motion";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/riot/assets";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface FavoriteChampionSlideProps {
  champion: string;
  games: number;
  winRate: number;
  avgKDA: number;
}

export function FavoriteChampionSlide({
  champion,
  games,
  winRate,
  avgKDA,
}: FavoriteChampionSlideProps) {
  return (
    <div className="relative w-full h-full">
      <BackgroundAnimation variant="gradient" intensity="medium" />
      <div className="relative z-10 text-center px-8 max-w-4xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-bold mb-8"
        >
          Your Favorite Champion
        </motion.h2>
        <div className="flex flex-col items-center gap-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              delay: 0.3,
              type: "spring",
              stiffness: 200,
              damping: 10,
            }}
            className="relative"
          >
            <Image
              src={getChampionImageUrl(champion)}
              alt={champion}
              width={200}
              height={200}
              className="rounded-lg"
            />
          </motion.div>
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-6xl font-bold text-blue-400"
          >
            {champion.toUpperCase()}
          </motion.h3>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="grid grid-cols-3 gap-6 mt-4"
          >
            <div className="bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">{games}</div>
              <div className="text-sm text-gray-400">Games</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold text-green-400">
                {(winRate * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-400">Win Rate</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">{avgKDA.toFixed(2)}</div>
              <div className="text-sm text-gray-400">Avg KDA</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
