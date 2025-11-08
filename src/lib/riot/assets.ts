import { DD_VERSION } from "../constants";

/**
 * Get champion square asset URL from Data Dragon CDN
 * @param championName - Champion name (e.g., "Yasuo", "MonkeyKing")
 * @returns URL to champion square image
 */
export function getChampionImageUrl(championName: string): string {
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
 * Get champion loading screen (splash art) URL from Community Dragon
 * Always uses base skin (skin 0) and centered version
 * @param championName - Champion name (e.g., "Ahri", "Yasuo")
 * @returns URL to champion splash art (centered, base skin)
 */
export function getChampionSplashUrl(championName: string): string {
  // Champion name must be lowercase in the URL path
  const championNameLower = championName.toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/${championNameLower}/skins/base/images/${championNameLower}_splash_centered_0.jpg`;
}

/**
 * Get ability icon URL from Data Dragon CDN
 * @param abilityImage - Ability image filename (e.g., "YasuoQ.png")
 * @returns URL to ability icon
 */
export function getAbilityIconUrl(abilityImage: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/spell/${abilityImage}`;
}
