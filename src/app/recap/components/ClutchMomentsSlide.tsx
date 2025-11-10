import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface ClutchMomentsSlideProps {
  outnumberedKills: number;
  killsUnderOwnTurret: number;
  savesAllyFromDeath: number;
  survivedThreeImmobilizes: number;
}

export function ClutchMomentsSlide({
  outnumberedKills,
  killsUnderOwnTurret,
  savesAllyFromDeath,
  survivedThreeImmobilizes,
}: ClutchMomentsSlideProps) {
  const moments = [
    {
      label: "Outnumbered Kills",
      value: outnumberedKills,
      emoji: "⚔️",
      description: "Kills when outnumbered",
      color: "from-red-400 to-orange-400",
      bgColor: "from-red-500/20 to-orange-500/20",
      borderColor: "border-red-500/30",
    },
    {
      label: "Turret Defense Kills",
      value: killsUnderOwnTurret,
      emoji: "🏰",
      description: "Kills under your turret",
      color: "from-blue-400 to-cyan-400",
      bgColor: "from-blue-500/20 to-cyan-500/20",
      borderColor: "border-blue-500/30",
    },
    {
      label: "Ally Saves",
      value: savesAllyFromDeath,
      emoji: "💚",
      description: "Times you saved an ally",
      color: "from-green-400 to-emerald-400",
      bgColor: "from-green-500/20 to-emerald-500/20",
      borderColor: "border-green-500/30",
    },
    {
      label: "Clutch Escapes",
      value: survivedThreeImmobilizes,
      emoji: "🏃",
      description: "Escaped from 3+ immobilizes",
      color: "from-purple-400 to-pink-400",
      bgColor: "from-purple-500/20 to-pink-500/20",
      borderColor: "border-purple-500/30",
    },
  ].filter((m) => m.value > 0);

  return (
    <div className="relative w-full h-full">
      <BackgroundAnimation variant="stars" intensity="medium" />
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl font-bold mb-4 bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent"
        >
          Your Clutch Moments
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-xl text-gray-400 mb-12 text-center"
        >
          When the pressure was on, you delivered!
        </motion.p>

        <div className="grid grid-cols-2 gap-6 w-full">
          {moments.map((moment, index) => (
            <motion.div
              key={moment.label}
              initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{
                delay: 0.4 + index * 0.15,
                duration: 0.6,
                type: "spring",
                stiffness: 100,
              }}
              className={`bg-gradient-to-br ${moment.bgColor} backdrop-blur-md rounded-2xl p-6 border ${moment.borderColor} shadow-xl hover:scale-105 transition-transform`}
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="text-5xl">{moment.emoji}</div>
                <div>
                  <div
                    className={`text-4xl font-bold bg-gradient-to-r ${moment.color} bg-clip-text text-transparent`}
                  >
                    {moment.value}
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {moment.label}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-300">{moment.description}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

