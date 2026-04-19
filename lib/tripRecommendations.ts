/**
 * US14: Helpers for itinerary recommendations — exclude avoided activities/locations
 * and filter by budget range.
 */

export interface RecommendableItem {
  _id?: string;
  name: string;
  address?: string;
  /** Optional estimated cost for budget filtering */
  estimatedCost?: number;
  [key: string]: unknown;
}

/**
 * Normalizes a string for case-insensitive and trimmed matching.
 */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Returns true if the item should be excluded because its name or address
 * matches any entry in avoidActivities or avoidLocations.
 */
export function matchesAvoidList(
  title: string,
  location: string | undefined,
  avoidActivities: string[],
  avoidLocations: string[],
): boolean {
  return shouldExclude(
    { name: title, address: location },
    avoidActivities,
    avoidLocations,
  );
}

function shouldExclude(
  item: RecommendableItem,
  avoidActivities: string[],
  avoidLocations: string[]
): boolean {
  const nameNorm = normalize(item.name);
  const addressNorm = item.address ? normalize(item.address) : "";

  for (const avoid of avoidActivities) {
    const a = normalize(avoid);
    if (a && (nameNorm.includes(a) || nameNorm === a)) return true;
  }
  for (const avoid of avoidLocations) {
    const a = normalize(avoid);
    if (a && (addressNorm.includes(a) || addressNorm === a || nameNorm.includes(a))) return true;
  }
  return false;
}

/**
 * Filters a list of activities/locations by avoid lists.
 * Use this when generating itinerary recommendations so excluded items do not appear.
 */
export function filterByAvoid<T extends RecommendableItem>(
  items: T[],
  avoidActivities: string[] = [],
  avoidLocations: string[] = []
): T[] {
  if (avoidActivities.length === 0 && avoidLocations.length === 0) {
    return items;
  }
  return items.filter(
    (item) => !shouldExclude(item, avoidActivities, avoidLocations)
  );
}

/**
 * Filters items to those within the given budget range (inclusive).
 * Items without estimatedCost are included (treated as "any budget").
 */
export function filterByBudgetRange<T extends RecommendableItem>(
  items: T[],
  budgetMin?: number,
  budgetMax?: number
): T[] {
  if (budgetMin == null && budgetMax == null) {
    return items;
  }
  return items.filter((item) => {
    const cost = item.estimatedCost;
    if (cost == null || cost === undefined) return true;
    if (budgetMin != null && cost < budgetMin) return false;
    if (budgetMax != null && cost > budgetMax) return false;
    return true;
  });
}

/**
 * Applies both avoid and budget filters for recommendation results.
 */
export function applyRecommendationFilters<T extends RecommendableItem>(
  items: T[],
  options: {
    avoidActivities?: string[];
    avoidLocations?: string[];
    budgetMin?: number;
    budgetMax?: number;
  }
): T[] {
  const { avoidActivities = [], avoidLocations = [], budgetMin, budgetMax } = options;
  let result = filterByAvoid(items, avoidActivities, avoidLocations);
  result = filterByBudgetRange(result, budgetMin, budgetMax);
  return result;
}
