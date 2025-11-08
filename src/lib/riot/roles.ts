/**
 * Get role icon URL from Community Dragon
 * League positions: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
 */

export type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

/**
 * Get role icon URL from Community Dragon
 * @param role - Role/position (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)
 * @returns URL to role icon image
 */
export function getRoleIconUrl(role: Role | string | undefined): string {
  if (!role) return "";

  const roleUpper = role.toUpperCase();
  
  // Map role names to Community Dragon URL format
  const roleMap: Record<string, string> = {
    TOP: "top",
    JUNGLE: "jungle",
    MIDDLE: "middle",
    BOTTOM: "bottom",
    UTILITY: "utility",
  };

  const rolePath = roleMap[roleUpper] || role.toLowerCase();
  
  // Use latest Community Dragon version (15.3 based on the example)
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-parties/global/default/icon-position-${rolePath}.png`;
}

/**
 * Get role display name
 */
export function getRoleName(role: Role | string | undefined): string {
  if (!role) return "";
  
  const roleUpper = role.toUpperCase();
  const roleNames: Record<string, string> = {
    TOP: "Top",
    JUNGLE: "Jungle",
    MIDDLE: "Mid",
    BOTTOM: "ADC",
    UTILITY: "Support",
  };
  
  return roleNames[roleUpper] || role;
}

