import { DD_VERSION } from "../constants";

/**
 * Get champion square asset URL from Data Dragon CDN
 * @param championName - Champion name (e.g., "Yasuo", "MonkeyKing")
 * @returns URL to champion square image
 */
export function getChampionImageUrl(championName: string): string {
  // Special case for Fiddlesticks - use tile image
  if (championName === "FiddleSticks") {
    return "https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/FiddleSticks_0.jpg";
  }
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion/${championName}.png`;
}

/**
 * Get item asset URL from Data Dragon CDN
 * @param itemId - Item ID
 * @returns URL to item image
 */
export function getItemImageUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/item/${itemId}.png`;
}

/**
 * Get profile icon asset URL from Data Dragon CDN
 * @param iconId - Profile icon ID
 * @returns URL to profile icon image
 */
export function getProfileIconUrl(iconId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/profileicon/${iconId}.png`;
}

/**
 * Get rank emblem URL
 * @param tier - Rank tier (e.g., "DIAMOND", "GOLD")
 * @returns URL to rank emblem image
 */
export function getRankEmblemUrl(tier: string): string {
  const tierUpper = tier.toUpperCase();
  return `https://dpm.lol/_next/image?url=%2Frank%2F${tierUpper}.webp&w=96&q=75`;
}

/**
 * Get champion loading screen (splash art) URL from Data Dragon CDN
 * Always uses base skin (skin 0)
 * @param championName - Champion name (e.g., "Ahri", "Yasuo", "Leblanc")
 * @returns URL to champion splash art (base skin)
 */
export function getChampionSplashUrl(championName: string): string {
  // Data Dragon uses the champion name as-is (case-sensitive, but most are capitalized)
  // Format: https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{championName}_0.jpg
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championName}_0.jpg`;
}

/**
 * Get ability icon URL from Data Dragon CDN
 * @param abilityImage - Ability image filename (e.g., "YasuoQ.png")
 * @returns URL to ability icon
 */
export function getAbilityIconUrl(abilityImage: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/spell/${abilityImage}`;
}

/**
 * Get summoner spell image URL from Data Dragon CDN
 * @param spellImage - Summoner spell image filename (e.g., "SummonerFlash.png")
 * @returns URL to summoner spell image
 */
export function getSummonerSpellImageUrl(spellImage: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/spell/${spellImage}`;
}

/**
 * Get rune image URL from Data Dragon CDN
 * @param runeIcon - Rune icon path (e.g., "perk-images/Styles/Domination/Electrocute/Electrocute.png")
 * @returns URL to rune image
 */
export function getRuneImageUrl(runeIcon: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/${runeIcon}`;
}

/**
 * Get objective icon URL from Community Dragon
 * @param objectiveType - Type of objective (kills, dragons, barons, towers, inhibitors, riftHeralds)
 * @returns URL to objective icon image
 */
export function getObjectiveIconUrl(objectiveType: string): string {
  // Community Dragon paths for objective icons - using game UI assets
  const objectiveMap: Record<string, string> = {
    kills: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/champion-icon-kill.png",
    dragons: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/champion-icon-dragon.png",
    barons: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/champion-icon-baron.png",
    towers: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/champion-icon-turret.png",
    inhibitors: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/champion-icon-inhibitor.png",
    riftHeralds: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/champion-icon-herald.png",
  };
  
  // Fallback to alternative paths if the above don't work
  const fallbackMap: Record<string, string> = {
    kills: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/tft/championsplashes/icon-kill.png",
    dragons: "https://ddragon.leagueoflegends.com/cdn/img/champion/Dragon.png",
    barons: "https://ddragon.leagueoflegends.com/cdn/img/champion/Baron.png",
    towers: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/tft/championsplashes/icon-turret.png",
    inhibitors: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/tft/championsplashes/icon-inhibitor.png",
    riftHeralds: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/tft/championsplashes/icon-herald.png",
  };
  
  return objectiveMap[objectiveType] || fallbackMap[objectiveType] || "";
}
