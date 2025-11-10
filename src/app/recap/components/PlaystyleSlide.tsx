import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface PlaystyleSlideProps {
  playstyle?: {
    type?: string;
    description?: string;
  };
  strengths?: string[];
  improvements?: string[];
}

export function PlaystyleSlide({
  playstyle,
  strengths,
  improvements,
}: PlaystyleSlideProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/splash8.png")' }}
      />
      <div className="absolute inset-0 bg-black/75" />
      <BackgroundAnimation variant="stars" intensity="low" />

      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-6xl mx-auto w-full">
        <div className="w-full max-w-5xl space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <div className="text-center text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-5">
              Champion&#39;s DNA
            </div>
            <p className="text-lg md:text-xl text-gray-200 font-light leading-relaxed text-center max-w-3xl mx-auto">
              {playstyle?.description ||
                "Every fight you take has a rhythm. Let\u2019s capture the way you tilt the rift in your favor."}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {strengths && strengths.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.25,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="bg-green-300/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10"
              >
                <div className="text-sm text-gray-300 font-light tracking-[0.25em] uppercase mb-4 text-left">
                  Strengths
                </div>
                <div className="space-y-3">
                  {strengths.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.08 }}
                      className="flex gap-3 "
                    >
                      <div className="text-lg text-green-300" aria-hidden>
                        •
                      </div>
                      <p className="text-base md:text-lg text-gray-200 leading-relaxed">
                        {item}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {improvements && improvements.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="bg-teal-600/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10"
              >
                <div className="text-sm text-gray-300 font-light tracking-[0.25em] uppercase mb-4 text-left">
                  Improvements
                </div>
                <div className="space-y-3">
                  {improvements.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + idx * 0.08 }}
                      className="flex gap-3"
                    >
                      <div className="text-lg text-blue-300" aria-hidden>
                        →
                      </div>
                      <p className="text-base md:text-lg text-gray-200 leading-relaxed">
                        {item}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
