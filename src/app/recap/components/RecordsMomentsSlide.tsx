import { motion } from "framer-motion";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface RecordsMomentsSlideProps {
  personalRecords?: {
    mostKills?: { value: number; matchId?: string };
    mostAssists?: { value: number; matchId?: string };
    mostDeaths?: { value: number; matchId?: string };
  };
  clutchMoments?: {
    outnumberedKills?: number;
    killsUnderOwnTurret?: number;
    savesAllyFromDeath?: number;
    survivedThreeImmobilizes?: number;
  };
  achievements?: {
    pentakills?: number;
    quadrakills?: number;
    tripleKills?: number;
    soloKills?: number;
    firstBloods?: number;
    perfectGames?: number;
    flawlessAces?: number;
    epicMonsterSteals?: number;
  };
  clutchMomentsInsight?: string;
}

export function RecordsMomentsSlide({
  personalRecords,
  clutchMoments,
  achievements,
  clutchMomentsInsight,
}: RecordsMomentsSlideProps) {
  const hasValue = (val?: number) => val !== undefined && val >= 1;
  const formatNumber = (num: number) =>
    num >= 1000 ? `${(num / 1000).toFixed(1)}K` : num.toString();

  const personalStats = [
    personalRecords?.mostKills && {
      label: "Kills",
      value: personalRecords.mostKills.value,
      textClass: "text-rose-600",
    },
    personalRecords?.mostAssists && {
      label: "Assists",
      value: personalRecords.mostAssists.value,
      textClass: "text-emerald-600",
    },
    personalRecords?.mostDeaths && {
      label: "Deaths",
      value: personalRecords.mostDeaths.value,
      gradient: undefined,
      textClass: "text-blue-600",
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: number;
    gradient?: string;
    textClass?: string;
  }>;

  const clutchStats = [
    {
      label: "Outnumbered Kills",
      value: clutchMoments?.outnumberedKills ?? 0,
      show: hasValue(clutchMoments?.outnumberedKills),
    },
    {
      label: "Turret Defense Kills",
      value: clutchMoments?.killsUnderOwnTurret ?? 0,
      show: hasValue(clutchMoments?.killsUnderOwnTurret),
    },
    {
      label: "Ally Saves",
      value: clutchMoments?.savesAllyFromDeath ?? 0,
      show: hasValue(clutchMoments?.savesAllyFromDeath),
    },
    {
      label: "Survived CC Chains",
      value: clutchMoments?.survivedThreeImmobilizes ?? 0,
      show: hasValue(clutchMoments?.survivedThreeImmobilizes),
    },
  ].filter((entry) => entry.show);

  const achievementMeta: Record<string, { label: string; textClass: string }> =
    {
      pentakills: {
        label: "Pentakills",
        textClass: "text-orange-600",
      },
      quadrakills: {
        label: "Quadrakills",
        textClass: "text-indigo-600",
      },
      tripleKills: {
        label: "Triple Kills",
        textClass: "text-pink-600",
      },
      soloKills: {
        label: "Solo Kills",
        textClass: "text-sky-600",
      },
      firstBloods: {
        label: "First Bloods",
        textClass: "text-teal-600",
      },
      perfectGames: {
        label: "Perfect Games",
        textClass: "text-amber-600",
      },
      flawlessAces: {
        label: "Flawless Aces",
        textClass: "text-violet-600",
      },
      epicMonsterSteals: {
        label: "Epic Monster Steals",
        textClass: "text-blue-600",
      },
    };

  const achievementStats = Object.entries(achievements ?? {})
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([key, value]) => {
      const meta = achievementMeta[key] ?? {
        label: key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (c) => c.toUpperCase()),
        textClass: "text-blue-200",
      };
      return {
        key,
        label: meta.label,
        value: value as number,
        textClass: meta.textClass,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/splash7.png')" }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <BackgroundAnimation variant="stars" intensity="low" />
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-10 w-full">
          {(clutchMomentsInsight || clutchStats.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.25,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="bg-black/40 border border-white/10 rounded-3xl px-10 py-8 backdrop-blur-md shadow-xl"
            >
              <div className="text-center text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-6">
                Across the Rift
              </div>
              {clutchesHeadline(clutchMomentsInsight)}
              {clutchStats.length > 0 && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {clutchStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-white/5 border border-white/5 rounded-2xl px-4 py-4 text-center backdrop-blur-sm"
                    >
                      <div className="text-3xl font-light text-white mb-1">
                        {formatNumber(stat.value)}
                      </div>
                      <div className="text-sm text-gray-300 uppercase tracking-wide">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {(personalStats.length > 0 || achievementStats.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.35,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="bg-black/40 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-xl"
            >
              <div className="grid md:grid-cols-2 gap-8">
                {personalStats.length > 0 && (
                  <div>
                    <div className="text-sm text-white font-light tracking-[0.3em] uppercase mb-6">
                      Most in one Game
                    </div>
                    <div className="space-y-4">
                      {personalStats.map((stat) => (
                        <div
                          key={stat.label}
                          className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3 border border-white/5"
                        >
                          <div className="text-lg font-light text-gray-300">
                            {stat.label}{" "}
                          </div>
                          <div
                            className={`text-4xl font-light ${stat.textClass ?? ""}`}
                          >
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {achievementStats.length > 0 && (
                  <div>
                    <div className="text-sm text-white font-light tracking-[0.3em] uppercase mb-6">
                      Achievement Highlights
                    </div>
                    <div className="space-y-4">
                      {achievementStats.map((stat) => (
                        <div
                          key={stat.key}
                          className=" flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3 border border-white/5"
                        >
                          <div className="text-lg font-light text-gray-300">
                            {stat.label}
                          </div>
                          <div
                            className={`text-3xl font-light ${stat.textClass}`}
                          >
                            {formatNumber(stat.value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function clutchesHeadline(insight?: string) {
  if (insight) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.35 }}
        className="text-2xl text-center italic leading-relaxed"
      >
        {insight}
      </motion.p>
    );
  }

  return (
    <p className="text-center text-gray-300 font-light text-lg">
      When every fight was on the line, you were the difference—stacking hero
      plays from defense to clutch saves.
    </p>
  );
}
