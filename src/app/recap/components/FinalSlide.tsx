import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface FinalSlideProps {
  puuid: string | null;
  region: string | null;
}

export function FinalSlide({ puuid, region }: FinalSlideProps) {
  const router = useRouter();

  return (
    <div className="relative w-full h-full">
      <BackgroundAnimation variant="stars" intensity="high" />
      <div className="relative z-10 text-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <motion.h1
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-6xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            Thanks for Playing!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="text-2xl text-gray-300 mb-8"
          >
            See you on the Rift in 2025
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (puuid && region) {
                router.push(
                  `/summoner/profile?puuid=${encodeURIComponent(puuid)}&region=${region}`
                );
              }
            }}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-semibold transition-colors"
          >
            Back to Profile
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
