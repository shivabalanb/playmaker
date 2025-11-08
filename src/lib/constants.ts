/**
 * Data Dragon version for League of Legends assets
 * Update periodically with new patches
 */
export const DD_VERSION = "15.22.1";

/**
 * Riot Games API rate limits (for reference)
 */
export const RATE_LIMITS = {
  DEVELOPMENT: {
    PER_SECOND: 20,
    PER_MINUTE: 100,
  },
} as const;

/**
 * League of Legends season timestamps
 */
export const SEASON_TIMESTAMPS = {
  SEASON_2025: 1736121600, // Jan 6, 2025 00:00:00 UTC
} as const;

