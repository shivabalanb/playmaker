import { motion } from "framer-motion";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/riot/assets";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface Champion {
  champion: string;
  games: number;
  winRate: number;
}

interface Top5ChampionsSlideProps {
  champions: Champion[];
}

export function Top5ChampionsSlide({ champions }: Top5ChampionsSlideProps) {
  return (
    <div className="relative w-full h-full">
      <BackgroundAnimation variant="particles" intensity="medium" />
      <div className="relative z-10 text-center px-8 max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold mb-8"
        >
          Your Top 5 Champions
        </motion.h2>
        <div className="grid grid-cols-5 gap-4">
          {champions.slice(0, 5).map((champ, index) => (
            <motion.div
              key={champ.champion}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: index * 0.15,
                type: "spring",
                stiffness: 200,
              }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-2">
                <Image
                  src={getChampionImageUrl(champ.champion)}
                  alt={champ.champion}
                  width={120}
                  height={120}
                  className="rounded-lg"
                />
                {index === 0 && (
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                )}
              </div>
              <div className="text-lg font-semibold">{champ.champion}</div>
              <div className="text-sm text-gray-400">{champ.games} games</div>
              <div className="text-xs text-green-400">
                {(champ.winRate * 100).toFixed(0)}% WR
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
