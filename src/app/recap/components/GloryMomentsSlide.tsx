import { motion } from "framer-motion";

interface GloryMomentsSlideProps {
  pentakills: number;
  quadrakills: number;
  tripleKills: number;
}

export function GloryMomentsSlide({
  pentakills,
  quadrakills,
  tripleKills,
}: GloryMomentsSlideProps) {
  const moments = [
    {
      label: "Pentakills",
      value: pentakills,
      icon: "👑",
      gradient: "from-yellow-600 to-orange-600",
      border: "border-yellow-400",
    },
    {
      label: "Quadrakills",
      value: quadrakills,
      icon: "⭐",
      gradient: "from-purple-600 to-pink-600",
      border: "border-purple-400",
    },
    {
      label: "Triple Kills",
      value: tripleKills,
      icon: "🎯",
      gradient: "from-blue-600 to-cyan-600",
      border: "border-blue-400",
    },
  ];

  return (
    <div className="text-center px-8 max-w-4xl">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold mb-12"
      >
        ⚡ Glory Moments
      </motion.h2>
      <div className="grid grid-cols-3 gap-6">
        {moments.map((moment, index) => (
          <motion.div
            key={moment.label}
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: index * 0.2, type: "spring", stiffness: 150 }}
            whileHover={{ scale: 1.05 }}
            className={`bg-gradient-to-br ${moment.gradient} rounded-lg p-8 text-center border-2 ${moment.border}`}
          >
            <div className="text-6xl mb-4">{moment.icon}</div>
            <div className="text-5xl font-bold mb-2">{moment.value}</div>
            <div className="text-xl font-semibold">{moment.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
