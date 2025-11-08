import { DD_VERSION } from "../constants";

/**
 * Rune data structure from Data Dragon
 */
interface RuneData {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
  longDesc: string;
  slots?: Array<{
    runes: Array<{
      id: number;
      key: string;
      icon: string;
      name: string;
      shortDesc: string;
      longDesc: string;
    }>;
  }>;
}

/**
 * Rune ID to data mapping cache
 * Fetched from Data Dragon runesReforged.json
 */
let runeCache: Map<number, RuneData> | null = null;

/**
 * Fetch and cache rune data from Data Dragon
 * @returns Map of runeId -> runeData
 */
export async function getRuneMap(): Promise<Map<number, RuneData>> {
  if (runeCache) {
    return runeCache;
  }

  try {
    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/data/en_US/runesReforged.json`
    );
    const data = await response.json();

    const map = new Map<number, RuneData>();

    // Data Dragon returns an array of rune trees (styles)
    for (const style of data as RuneData[]) {
      // Add the main keystone (style itself)
      map.set(style.id, style);

      // Add all runes in each slot
      if (style.slots) {
        for (const slot of style.slots) {
          for (const rune of slot.runes) {
            map.set(rune.id, rune);
          }
        }
      }
    }

    runeCache = map;
    return map;
  } catch (error) {
    console.error("Failed to fetch rune data:", error);
    return new Map();
  }
}

/**
 * Get rune data by ID
 * @param runeId - Rune ID
 * @returns Rune data or null if not found
 */
export async function getRuneById(runeId: number): Promise<RuneData | null> {
  const map = await getRuneMap();
  return map.get(runeId) || null;
}

