import { motion } from "framer-motion";

interface PersonalRecordsSlideProps {
  mostKills: number;
  mostAssists: number;
  mostDeaths: number;
}

export function PersonalRecordsSlide({
  mostKills,
  mostAssists,
  mostDeaths,
}: PersonalRecordsSlideProps) {
  const records = [
    {
      label: "Most Kills",
      value: mostKills,
      color: "text-green-400",
      border: "border-green-500",
    },
    {
      label: "Most Assists",
      value: mostAssists,
      color: "text-blue-400",
      border: "border-blue-500",
    },
    {
      label: "Most Deaths",
      value: mostDeaths,
      color: "text-red-400",
      border: "border-red-500",
    },
  ];

  return (
    <div className="text-center px-8 max-w-4xl">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold mb-12"
      >
        Personal Records
      </motion.h2>
      <div className="grid grid-cols-3 gap-6">
        {records.map((record, index) => (
          <motion.div
            key={record.label}
            initial={{ opacity: 0, y: 100, rotateX: -90 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: index * 0.2, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.05, z: 20 }}
            className={`bg-gray-800/50 rounded-lg p-8 text-center border-2 ${record.border} backdrop-blur-sm`}
          >
            <div className="text-2xl mb-4">{record.label}</div>
            <div className={`text-6xl font-bold ${record.color}`}>
              {record.value}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
