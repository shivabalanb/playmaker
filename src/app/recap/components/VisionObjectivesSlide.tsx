import { motion } from "framer-motion";
import Image from "next/image";
import { getObjectiveIconUrl } from "@/lib/riot/assets";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface VisionObjectivesSlideProps {
  vision?: {
    totalVisionScore?: number;
    averageVisionScore?: number;
    totalWardsPlaced?: number;
    totalWardsDestroyed?: number;
    totalControlWardsPlaced?: number;
    visionScorePerMinute?: number;
  };
  objectives?: {
    totalDragonTakedowns?: number;
    totalBaronTakedowns?: number;
    totalTurretTakedowns?: number;
    firstTurretRate?: number;
    epicMonsterSteals?: number;
    riftHeraldTakedowns?: number;
  };
  communication?: {
    totalPings?: number;
    averagePingsPerGame?: number;
    pingBreakdown?: {
      assistMe?: number;
      danger?: number;
      onMyWay?: number;
      enemyMissing?: number;
      enemyVision?: number;
      getBack?: number;
      retreat?: number;
      command?: number;
      allIn?: number;
    };
  };
}

export function VisionObjectivesSlide({
  vision,
  objectives,
  communication,
}: VisionObjectivesSlideProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  // Filter out values close to 0 (less than 1)
  const hasValue = (val?: number) => val !== undefined && val >= 1;

  // CommunityDragon ping icons
  const PING_ICON_BASE =
    "https://raw.communitydragon.org/latest/game/assets/ux/minimap/pings";
  const getPingIconUrl = (name: string) => {
    switch (name) {
      case "On My Way":
        return `${PING_ICON_BASE}/on_my_way_new.png`;
      case "Get Back":
        return `${PING_ICON_BASE}/get_back_small.png`;
      case "Command":
        // No direct 'command' asset in some builds; fallback to generic 'ping'
        return `${PING_ICON_BASE}/ping.png`;
      case "Assist Me":
        return `${PING_ICON_BASE}/assist.png`;
      case "Enemy Missing":
        return `${PING_ICON_BASE}/mia_new.png`;
      case "Enemy Vision":
        // Use warded indicator as "enemy vision"
        return `${PING_ICON_BASE}/area_is_warded_small_red_new.png`;
      case "All In":
        return `${PING_ICON_BASE}/all_in.png`;
      default:
        return `${PING_ICON_BASE}/ping.png`;
    }
  };

  const objectiveMetrics = [
    {
      label: "Dragons",
      value: objectives?.totalDragonTakedowns,
      gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      iconUrl:
        "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dragon-100.png",
      valueClass: "text-4xl font-light",
    },
    {
      label: "Barons",
      value: objectives?.totalBaronTakedowns,
      gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
      iconUrl:
        "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-100.png",
      valueClass: "text-4xl font-light",
    },
    {
      label: "Turrets",
      value: objectives?.totalTurretTakedowns,
      iconUrl:
        "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/tower-100.png",
      valueClass: "text-4xl font-light text-white",
      formatValue: (num: number) => formatNumber(num),
    },
    {
      label: "Epic Steals",
      value: objectives?.epicMonsterSteals,
      gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      iconEmoji: "⚡",
      valueClass: "text-3xl font-light",
    },
    {
      label: "Rift Heralds",
      value: objectives?.riftHeraldTakedowns,
      iconUrl: getObjectiveIconUrl("riftHeralds"),
      valueClass: "text-3xl font-light text-cyan-400",
    },
  ].filter((metric) => hasValue(metric.value));

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/splash5.png')" }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <BackgroundAnimation variant="stars" intensity="low" />
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-8 w-full">
          {/* Vision - blurred card with lead-in */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-6"
          >
            <div className="text-center text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-6">
              Eyes on Victory
            </div>
            <p className="text-sm md:text-base text-gray-300 font-light leading-relaxed text-center max-w-3xl mx-auto">
              Your map awareness shaped every fight!
            </p>
            <div className="flex gap-8 justify-center mb-2">
              {hasValue(vision?.totalVisionScore) && (
                <div className="text-center">
                  <div className="text-4xl font-light text-white mb-1">
                    {formatNumber(vision?.totalVisionScore as number)}
                  </div>
                  <div className="text-sm text-gray-300 font-light">
                    Total Vision
                  </div>
                </div>
              )}
              {hasValue(vision?.averageVisionScore) && (
                <div className="text-center">
                  <div className="text-4xl font-light text-white mb-1">
                    {(vision?.averageVisionScore ?? 0).toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-300 font-light">
                    Avg Per Game
                  </div>
                </div>
              )}
            </div>

            {/* Wards Horizontal List */}
            <div className="flex gap-8 justify-center">
              {hasValue(vision?.totalWardsPlaced) && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Image
                      src="https://raw.communitydragon.org/latest/game/assets/characters/yellowtrinket/hud/yellowtrinket_square.png"
                      alt="Yellow Trinket"
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                    <div className="text-3xl font-light text-blue-400">
                      {formatNumber(vision?.totalWardsPlaced as number)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-300 font-light">
                    Wards Placed
                  </div>
                </div>
              )}
              {hasValue(vision?.totalWardsDestroyed) && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="text-3xl font-light text-green-400">
                      {formatNumber(vision?.totalWardsDestroyed as number)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-300 font-light">
                    Wards Destroyed
                  </div>
                </div>
              )}
              {hasValue(vision?.totalControlWardsPlaced) && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Image
                      src="https://raw.communitydragon.org/latest/game/assets/items/icons2d/2055_class_t1_controlward.png"
                      alt="Control Ward"
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                    <div className="text-3xl font-light text-purple-400">
                      {formatNumber(vision?.totalControlWardsPlaced as number)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-300 font-light">
                    Control Wards
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Objectives and Communication - blurred card with lead-in */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
          >
            <p className="text-sm md:text-base text-gray-300 font-light leading-relaxed text-center max-w-3xl mx-auto mb-8">
              Captured objectives and clear comms turn close games into wins.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-6 w-full items-center justify-center">
              {/* Objectives Stats */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="space-y-6 md:pr-6 "
              >
                {objectiveMetrics.length > 0 && (
                  <div className=" grid grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
                    {objectiveMetrics.map((metric) => {
                      const displayValue = metric.formatValue
                        ? metric.formatValue(metric.value as number)
                        : formatNumber(metric.value as number);
                      const valueClass =
                        metric.valueClass ?? "text-4xl font-light text-white";
                      const gradientStyle = metric.gradient
                        ? {
                            background: metric.gradient,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                          }
                        : undefined;

                      return (
                        <div
                          key={metric.label}
                          className="text-center space-y-2"
                        >
                          <div className="flex items-center justify-center gap-2">
                            {metric.iconUrl ? (
                              <Image
                                src={metric.iconUrl}
                                alt={metric.label}
                                width={32}
                                height={32}
                                className="object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-2xl">
                                {metric.iconEmoji}
                              </span>
                            )}
                            <div className={valueClass} style={gradientStyle}>
                              {displayValue}
                            </div>
                          </div>
                          <div className="text-sm text-gray-300 font-light">
                            {metric.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              <div className="hidden md:block w-px bg-white/10 rounded-full" />

              {/* Communication Stats */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.45,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="space-y-6 md:pl-6 flex flex-col justify-center "
              >
                <div className="flex flex-wrap gap-6 md:gap-8 justify-center mb-6">
                  {hasValue(communication?.totalPings) && (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <div className="text-2xl">📢</div>
                        <div className="text-4xl font-light text-white">
                          {formatNumber(communication?.totalPings as number)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-300 font-light">
                        Total Pings
                      </div>
                    </div>
                  )}
                  {hasValue(communication?.averagePingsPerGame) && (
                    <div className="text-center">
                      <div className="text-4xl font-light text-white mb-1">
                        {(communication?.averagePingsPerGame ?? 0).toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-300 font-light">
                        Avg Per Game
                      </div>
                    </div>
                  )}
                </div>
                {communication?.pingBreakdown &&
                  (() => {
                    const pingTypes = [
                      {
                        name: "On My Way",
                        value: communication.pingBreakdown.onMyWay || 0,
                      },
                      {
                        name: "Get Back",
                        value: communication.pingBreakdown.getBack || 0,
                      },
                      {
                        name: "Command",
                        value: communication.pingBreakdown.command || 0,
                      },
                      {
                        name: "Assist Me",
                        value: communication.pingBreakdown.assistMe || 0,
                      },
                      {
                        name: "Enemy Missing",
                        value: communication.pingBreakdown.enemyMissing || 0,
                      },
                      {
                        name: "Enemy Vision",
                        value: communication.pingBreakdown.enemyVision || 0,
                      },
                      {
                        name: "All In",
                        value: communication.pingBreakdown.allIn || 0,
                      },
                    ].filter((ping) => ping.value >= 1);

                    if (pingTypes.length === 0) return null;

                    const mostUsed = pingTypes.reduce((max, ping) =>
                      ping.value > max.value ? ping : max
                    );
                    const leastUsed = pingTypes.reduce((min, ping) =>
                      ping.value < min.value ? ping : min
                    );

                    return (
                      <div className="space-y-4 mt-4 mx-auto">
                        <div>
                          <div className="text-sm text-gray-300 font-light tracking-wider uppercase mb-2">
                            Most Used
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                              <Image
                                src={getPingIconUrl(mostUsed.name)}
                                alt={mostUsed.name}
                                width={20}
                                height={20}
                                className="object-contain"
                              />
                              <span className="text-gray-300 text-sm">
                                {mostUsed.name}
                              </span>
                            </div>
                            <span className="ml-auto text-white font-light text-lg">
                              {formatNumber(mostUsed.value)}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-300 font-light tracking-wider uppercase mb-2">
                            Least Used
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                              <Image
                                src={getPingIconUrl(leastUsed.name)}
                                alt={leastUsed.name}
                                width={20}
                                height={20}
                                className="object-contain"
                              />
                              <span className="text-gray-300 text-sm">
                                {leastUsed.name}
                              </span>
                            </div>
                            <span className="ml-auto text-white font-light text-lg">
                              {formatNumber(leastUsed.value)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
