import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface PoemSlideProps {
  poem: string;
}

export function PoemSlide({ poem }: PoemSlideProps) {
  const lines = poem.split("\n").filter((line) => line.trim());

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/splash9.png')" }}
      />
      <div className="absolute inset-0 bg-black/80" />
      <BackgroundAnimation variant="stars" intensity="low" />

      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-4xl mx-auto ">
      

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full bg-white/5 backdrop-blur-sm rounded-2xl p-12 py-20 border border-white/10"
        >
          <div className="space-y-5 text-center">
          <div className="text-lg text-gray-300 font-light tracking-[0.2em] uppercase mb-20">
            A Poem for a Summoner
          </div>
            {lines.map((line, index) => (
              <motion.p
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.08 }}
                className="text-xl md:text-2xl text-gray-200 leading-relaxed font-light italic"
              >
                {line.trim()}
              </motion.p>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
