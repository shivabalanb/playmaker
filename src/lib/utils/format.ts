/**
 * Format game duration from seconds to MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "25:43")
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format timestamp to relative time ago
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2h ago", "5d ago")
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}y ago`;
  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

/**
 * Format number with commas (e.g., 1000000 → "1,000,000")
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Format KDA ratio
 * @param kills - Number of kills
 * @param deaths - Number of deaths
 * @param assists - Number of assists
 * @returns KDA ratio (e.g., "3.5" or "Perfect")
 */
export function formatKDA(
  kills: number,
  deaths: number,
  assists: number
): string {
  if (deaths === 0) return "Perfect";
  return ((kills + assists) / deaths).toFixed(1);
}

/**
 * Format win rate percentage
 * @param wins - Number of wins
 * @param losses - Number of losses
 * @returns Win rate percentage string (e.g., "55%")
 */
export function formatWinRate(wins: number, losses: number): string {
  if (wins + losses === 0) return "0%";
  return `${Math.round((wins / (wins + losses)) * 100)}%`;
}

/**
 * Format CS per minute
 * @param cs - Total CS (creep score)
 * @param durationSeconds - Game duration in seconds
 * @returns CS per minute (e.g., "7.2")
 */
export function formatCSPerMinute(cs: number, durationSeconds: number): string {
  if (durationSeconds === 0) return "0.0";
  return ((cs / durationSeconds) * 60).toFixed(1);
}

/**
 * Format large numbers to shortened format (e.g., 1500 → "1.5k", 2500000 → "2.5M")
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Shortened number string
 */
export function formatLargeNumber(value: number, decimals: number = 1): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(decimals)}k`;
  }
  return value.toString();
}

/**
 * Format gold to shortened format (e.g., 15420 → "15.4k")
 * @param gold - Gold amount
 * @returns Shortened gold string
 */
export function formatGold(gold: number): string {
  return formatLargeNumber(gold);
}

/**
 * Format damage to shortened format (e.g., 25420 → "25.4k")
 * @param damage - Damage amount
 * @returns Shortened damage string
 */
export function formatDamage(damage: number): string {
  return formatLargeNumber(damage);
}
