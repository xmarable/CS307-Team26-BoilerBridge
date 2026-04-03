/**
 * Strict check for a 24-char hex MongoDB ObjectId string.
 * Use for deep-linking to /dashboard/activities/[id] from itinerary cards.
 */
export function isValidActivityMongoId(id: string | undefined | null): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{24}$/i.test(id);
}
