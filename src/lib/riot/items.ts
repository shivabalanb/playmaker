/**
 * All boots item IDs (Base, Tier 2, and Tier 3)
 */
const BOOTS_IDS: readonly number[] = [
  // Base Boots
  1001, // Boots
  2422, // Slightly Magical Footwear

  // Tier 2 Boots
  3006, // Berserker's Greaves
  3009, // Boots of Swiftness
  3010, // Symbiotic Soles
  3020, // Sorcerer's Shoes
  3047, // Plated Steelcaps
  3111, // Mercury's Treads
  3158, // Ionian Boots of Lucidity

  // Tier 3 Boots
  3170, // Swiftmarch (from Boots of Swiftness)
  3171, // Crimson Lucidity (from Ionian Boots of Lucidity)
  3172, // Gunmetal Greaves (from Berserker's Greaves)
  3173, // Chainlaced Crushers (from Mercury's Treads)
  3174, // Armored Advance (from Plated Steelcaps)
  3175, // Spellslinger's Shoes (from Sorcerer's Shoes)
  3176, // Synchronized Souls (from Symbiotic Soles)
];

/**
 * Trinket item slot (item6)
 */
export const TRINKET_SLOT = 6;

/**
 * Check if an item is boots
 * @param itemId - Item ID to check
 * @returns True if item is boots
 */
export function isBoots(itemId: number): boolean {
  return BOOTS_IDS.includes(itemId);
}

/**
 * Reorder items array to put boots first (if present)
 * Useful for consistent item display in UI
 * @param items - Array of item IDs
 * @returns Reordered array with boots first
 */
export function reorderItemsWithBootsFirst(items: number[]): number[] {
  const bootsIndex = items.findIndex((item) => item > 0 && isBoots(item));

  // No boots or boots already first
  if (bootsIndex === -1 || bootsIndex === 0) {
    return items;
  }

  // Move boots to first position
  const reordered = [...items];
  const boots = reordered[bootsIndex];
  reordered.splice(bootsIndex, 1);
  reordered.unshift(boots);

  return reordered;
}

/**
 * Extract regular items (slots 0-5) and trinket (slot 6) from participant data
 * @param participant - Match participant data
 * @returns Object with regularItems and trinketItem
 */
export function extractPlayerItems(participant: {
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
}): {
  regularItems: number[];
  trinketItem: number;
} {
  const rawItems = [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
  ];

  // Sort by item ID in descending order
  const sortedItems = [...rawItems].sort((a, b) => b - a);

  // Reorder to put boots first
  const regularItems = reorderItemsWithBootsFirst(sortedItems);
  const trinketItem = participant.item6;

  return { regularItems, trinketItem };
}
