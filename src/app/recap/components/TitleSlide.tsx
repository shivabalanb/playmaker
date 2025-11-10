import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface TitleSlideProps {
  totalGames: number;
}

export function TitleSlide({ totalGames }: TitleSlideProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/splash1.png')",
        }}
      />
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/50" />
      <BackgroundAnimation variant="stars" intensity="low" />
      <div className="relative z-10 text-center px-8 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8"
        >
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="text-[10rem] md:text-[14rem] font-medium tracking-tight leading-none text-white"
            
          >
            JOURNEY
          </motion.h1>
        </motion.div>
      </div>
    </div>
  );
}
