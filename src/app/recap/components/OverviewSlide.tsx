import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface OverviewSlideProps {
  overview: string;
  winRate: number;
  totalGames: number;
}

export function OverviewSlide({
  overview,
  winRate,
  totalGames,
}: OverviewSlideProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <BackgroundAnimation variant="stars" intensity="low" />
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-7xl md:text-8xl font-light tracking-tight mb-16 text-center"
          style={{
            background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Your Season Overview
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex gap-12 justify-center mb-12"
        >
          <div className="text-center">
            <div className="text-6xl font-light text-white mb-2">
              {totalGames}
            </div>
            <div className="text-sm text-gray-400 font-light tracking-wider uppercase">
              Games Played
            </div>
          </div>
          <div className="w-px bg-white/10"></div>
          <div className="text-center">
            <div
              className="text-6xl font-light mb-2"
              style={{
                background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {(winRate * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400 font-light tracking-wider uppercase">
              Win Rate
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <p className="text-2xl leading-relaxed text-gray-300 text-center font-light tracking-wide">
            {overview}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
