/**
 * Queue ID to game type mapping (non-deprecated queues only)
 * Based on Riot Games API documentation
 */
const QUEUE_TYPES: Record<number, string> = {
  0: "Custom",
  400: "Normal Draft",
  420: "Ranked Solo/Duo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Nexus Blitz",
  490: "Quickplay",
  700: "Clash",
  720: "ARAM Clash",
  870: "Intro Bots",
  880: "Beginner Bots",
  890: "Intermediate Bots",
  900: "ARURF",
  910: "Ascension",
  920: "Poro King",
  940: "Nexus Siege",
  950: "Doom Bots",
  960: "Doom Bots",
  980: "Star Guardian",
  990: "Star Guardian Onslaught",
  1000: "PROJECT: Hunters",
  1010: "Snow ARURF",
  1020: "One for All",
  1090: "TFT",
  1100: "Ranked TFT",
  1110: "TFT Tutorial",
  1210: "TFT Choncc's Treasure",
  1300: "Nexus Blitz",
  1400: "Ultimate Spellbook",
  1700: "Arena",
  1710: "Arena",
  1810: "Swarm (1p)",
  1820: "Swarm (2p)",
  1830: "Swarm (3p)",
  1840: "Swarm (4p)",
  1900: "Pick URF",
  2000: "Tutorial 1",
  2010: "Tutorial 2",
  2020: "Tutorial 3",
};

/**
 * Ranked queue IDs
 */
export const RANKED_QUEUES = {
  SOLO_DUO: 420,
  FLEX: 440,
  CLASH: 700,
} as const;

/**
 * Swarm queue IDs
 */
export const SWARM_QUEUES = {
  SWARM_1P: 1810,
  SWARM_2P: 1820,
  SWARM_3P: 1830,
  SWARM_4P: 1840,
} as const;

/**
 * Get human-readable queue type name
 * @param queueId - Queue ID from match data
 * @returns Queue type name or generic "Queue {id}"
 */
export function getQueueType(queueId: number): string {
  return QUEUE_TYPES[queueId] || `Queue ${queueId}`;
}

/**
 * Check if a queue is ranked (Solo/Duo, Flex, or Clash)
 * @param queueId - Queue ID from match data
 * @returns True if queue is ranked
 */
export function isRankedQueue(queueId: number): boolean {
  return (
    queueId === RANKED_QUEUES.SOLO_DUO ||
    queueId === RANKED_QUEUES.FLEX ||
    queueId === RANKED_QUEUES.CLASH
  );
}

/**
 * Check if a queue is Solo/Duo ranked only
 * @param queueId - Queue ID from match data
 * @returns True if queue is Solo/Duo ranked
 */
export function isSoloQueueRanked(queueId: number): boolean {
  return queueId === RANKED_QUEUES.SOLO_DUO;
}

/**
 * Check if a queue is a Swarm match
 * @param queueId - Queue ID from match data
 * @returns True if queue is a Swarm match
 */
export function isSwarmQueue(queueId: number): boolean {
  return (
    queueId === SWARM_QUEUES.SWARM_1P ||
    queueId === SWARM_QUEUES.SWARM_2P ||
    queueId === SWARM_QUEUES.SWARM_3P ||
    queueId === SWARM_QUEUES.SWARM_4P
  );
}

/**
 * Get queue category
 * @param queueId - Queue ID from match data
 * @returns Queue category (ranked, normal, aram, etc.)
 */
export function getQueueCategory(
  queueId: number
): "ranked" | "normal" | "aram" | "rotating" | "custom" | "tutorial" | "other" {
  if (isRankedQueue(queueId)) return "ranked";
  if (queueId === 450 || queueId === 720) return "aram";
  if (queueId === 400 || queueId === 430 || queueId === 490) return "normal";
  if (queueId >= 2000 && queueId <= 2020) return "tutorial";
  if (queueId === 0) return "custom";
  return "rotating";
}

/**
 * Check if a queue supports match review
 * @param queueId - Queue ID from match data
 * @returns True if queue supports review (Ranked Solo/Duo, Ranked Flex, Normals, Quickplay, ARAM)
 */
export function isReviewableQueue(queueId: number): boolean {
  return (
    queueId === 420 || // Ranked Solo/Duo
    queueId === 440 || // Ranked Flex
    queueId === 400 || // Normal Draft
    queueId === 430 || // Normal Blind
    queueId === 450 || // ARAM
    queueId === 490    // Quickplay
  );
}

