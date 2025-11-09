import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface TitleSlideProps {
  totalGames: number;
}

export function TitleSlide({ totalGames }: TitleSlideProps) {
  return (
    <div className="relative w-full h-full">
      <BackgroundAnimation variant="stars" intensity="high" />
      <div className="relative z-10 text-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <motion.h1
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-7xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            YOUR 2025 SEASON RECAP
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="text-2xl text-gray-300"
          >
            {totalGames} games played
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
