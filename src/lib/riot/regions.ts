/**
 * Riot Games API region types
 */
export type RoutingRegion = "americas" | "europe" | "asia" | "sea";
export type PlatformRegion =
  | "na1"
  | "br1"
  | "la1"
  | "la2"
  | "euw1"
  | "eun1"
  | "tr1"
  | "ru"
  | "kr"
  | "jp1"
  | "oc1"
  | "ph2"
  | "sg2"
  | "th2"
  | "tw2"
  | "vn2";

/**
 * Routing region to platform region mapping
 */
const PLATFORM_MAP: Record<RoutingRegion, PlatformRegion> = {
  americas: "na1",
  europe: "euw1",
  asia: "kr",
  sea: "sg2",
};

/**
 * Map routing region (used for match API) to platform region (used for summoner/league API)
 * @param routingRegion - Routing region (americas, europe, asia, sea)
 * @returns Platform region (na1, euw1, kr, sg2, etc.)
 */
export function getPlatformRegion(routingRegion: string): PlatformRegion {
  return PLATFORM_MAP[routingRegion as RoutingRegion] || "na1";
}

/**
 * Map platform region to routing region
 * @param platformRegion - Platform region (na1, euw1, kr, etc.)
 * @returns Routing region (americas, europe, asia, sea)
 */
export function getRoutingRegion(platformRegion: string): RoutingRegion {
  const lowerPlatform = platformRegion.toLowerCase();

  // Americas
  if (["na1", "br1", "la1", "la2"].includes(lowerPlatform)) {
    return "americas";
  }

  // Europe
  if (["euw1", "eun1", "tr1", "ru"].includes(lowerPlatform)) {
    return "europe";
  }

  // Asia
  if (["kr", "jp1"].includes(lowerPlatform)) {
    return "asia";
  }

  // SEA (Southeast Asia)
  if (["ph2", "sg2", "th2", "tw2", "vn2", "oc1"].includes(lowerPlatform)) {
    return "sea";
  }

  // Default to americas
  return "americas";
}

/**
 * Get human-readable region name
 * @param region - Platform or routing region
 * @returns Human-readable region name
 */
export function getRegionName(region: string): string {
  const regionNames: Record<string, string> = {
    na1: "North America",
    br1: "Brazil",
    la1: "Latin America North",
    la2: "Latin America South",
    euw1: "Europe West",
    eun1: "Europe Nordic & East",
    tr1: "Turkey",
    ru: "Russia",
    kr: "Korea",
    jp1: "Japan",
    oc1: "Oceania",
    ph2: "Philippines",
    sg2: "Singapore",
    th2: "Thailand",
    tw2: "Taiwan",
    vn2: "Vietnam",
    americas: "Americas",
    europe: "Europe",
    asia: "Asia",
    sea: "Southeast Asia",
  };

  return regionNames[region.toLowerCase()] || region.toUpperCase();
}

