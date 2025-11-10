import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface PlaystyleSlideProps {
  playstyle?: {
    type?: string;
    description?: string;
  };
  strengths?: string[];
  recommendations?: string[];
}

export function PlaystyleSlide({
  playstyle,
  strengths,
  recommendations,
}: PlaystyleSlideProps) {
  return (
    <div className="relative w-full h-full">
      <BackgroundAnimation variant="waves" intensity="medium" />
      <div className="relative z-10 text-center px-8 max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold mb-8"
        >
          Your Playstyle
        </motion.h2>
        {playstyle && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="bg-gray-800/50 rounded-lg p-8 mb-6 backdrop-blur-sm border border-purple-500"
          >
            <h3 className="text-3xl font-bold mb-4 text-purple-300">
              {playstyle.type}
            </h3>
            <p className="text-xl text-gray-300">{playstyle.description}</p>
          </motion.div>
        )}
        <div className="grid grid-cols-2 gap-4 mt-6">
          {strengths && strengths.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-800/50 rounded-lg p-6 backdrop-blur-sm border border-green-500"
            >
              <h4 className="text-xl font-bold mb-3 text-green-400">
                Strengths
              </h4>
              <ul className="text-left space-y-2 text-gray-300">
                {strengths.map((s, idx) => (
                  <li key={idx}>• {s}</li>
                ))}
              </ul>
            </motion.div>
          )}
          {recommendations && recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-800/50 rounded-lg p-6 backdrop-blur-sm border border-blue-500"
            >
              <h4 className="text-xl font-bold mb-3 text-blue-400">
                Recommendations
              </h4>
              <ul className="text-left space-y-2 text-gray-300">
                {recommendations.map((r, idx) => (
                  <li key={idx}>• {r}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
