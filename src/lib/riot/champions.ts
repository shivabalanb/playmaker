import { DD_VERSION } from "../constants";

/**
 * Champion ID to Name mapping cache
 * Fetched from Data Dragon champion.json
 */
let championIdToNameCache: Map<number, string> | null = null;

/**
 * Fetch and cache champion ID to name mapping from Data Dragon
 * @returns Map of championId -> championName
 */
async function getChampionIdToNameMap(): Promise<Map<number, string>> {
  if (championIdToNameCache) {
    return championIdToNameCache;
  }

  try {
    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/data/en_US/champion.json`
    );
    const data = await response.json();

    const map = new Map<number, string>();
    for (const [championName, championData] of Object.entries(
      data.data as Record<string, { key: string }>
    )) {
      const championId = parseInt((championData as { key: string }).key);
      map.set(championId, championName);
    }

    championIdToNameCache = map;
    return map;
  } catch (error) {
    console.error("Failed to fetch champion data:", error);
    return new Map();
  }
}

/**
 * Convert champion ID to champion name
 * @param championId - Champion ID from mastery API
 * @returns Champion name (e.g., "Yasuo", "MonkeyKing") or null if not found
 */
export async function getChampionNameById(
  championId: number
): Promise<string | null> {
  const map = await getChampionIdToNameMap();
  return map.get(championId) || null;
}

/**
 * Get champion name from ID synchronously (uses cache)
 * Returns null if cache not loaded yet
 * @param championId - Champion ID from mastery API
 * @returns Champion name or null
 */
export function getChampionNameByIdSync(championId: number): string | null {
  if (!championIdToNameCache) {
    return null;
  }
  return championIdToNameCache.get(championId) || null;
}
