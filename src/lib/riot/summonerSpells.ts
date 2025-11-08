import { DD_VERSION } from "../constants";

/**
 * Summoner spell data structure from Data Dragon
 */
interface SummonerSpellData {
  id: string;
  name: string;
  key: string; // Numeric ID as string
  image: {
    full: string;
  };
}

/**
 * Summoner spell ID to data mapping cache
 * Fetched from Data Dragon summoner.json
 */
let summonerSpellCache: Map<number, SummonerSpellData> | null = null;

/**
 * Fetch and cache summoner spell data from Data Dragon
 * @returns Map of spellId -> spellData
 */
export async function getSummonerSpellMap(): Promise<
  Map<number, SummonerSpellData>
> {
  if (summonerSpellCache) {
    return summonerSpellCache;
  }

  try {
    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/data/en_US/summoner.json`
    );
    const data = await response.json();

    const map = new Map<number, SummonerSpellData>();
    for (const [spellKey, spellData] of Object.entries(
      data.data as Record<string, SummonerSpellData>
    )) {
      const spellId = parseInt((spellData as SummonerSpellData).key);
      map.set(spellId, spellData as SummonerSpellData);
    }

    summonerSpellCache = map;
    return map;
  } catch (error) {
    console.error("Failed to fetch summoner spell data:", error);
    return new Map();
  }
}

/**
 * Get summoner spell data by ID
 * @param spellId - Summoner spell ID (e.g., 4 for Flash)
 * @returns Summoner spell data or null if not found
 */
export async function getSummonerSpellById(
  spellId: number
): Promise<SummonerSpellData | null> {
  const map = await getSummonerSpellMap();
  return map.get(spellId) || null;
}

