import type { TripContext } from "@/lib/itinerary/generateFull";
import {
  AccessibilityRequirementsSchema,
  type AccessibilityRequirements,
} from "@/lib/itinerary/schemas";

type TripDocLike = {
  fromCity?: unknown;
  toCity?: unknown;
  fromDate?: unknown;
  toDate?: unknown;
  mode?: unknown;
  budget?: unknown;
  budgetMin?: unknown;
  budgetMax?: unknown;
  avoidActivities?: unknown;
  avoidLocations?: unknown;
  accessibilityRequirements?: unknown;
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function mapTripToGenerationContext(trip: TripDocLike): TripContext {
  const parsedBudget =
    typeof trip.budget === "number" ? trip.budget : Number(trip.budget);
  const budget = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 500;

  const parsedBudgetMin =
    typeof trip.budgetMin === "number" ? trip.budgetMin : Number(trip.budgetMin);
  const parsedBudgetMax =
    typeof trip.budgetMax === "number" ? trip.budgetMax : Number(trip.budgetMax);

  const budgetMin = Number.isFinite(parsedBudgetMin) ? parsedBudgetMin : undefined;
  const budgetMax = Number.isFinite(parsedBudgetMax) ? parsedBudgetMax : undefined;

  const accessibilityRequirements: AccessibilityRequirements =
    AccessibilityRequirementsSchema.parse(trip.accessibilityRequirements ?? {});

  return {
    fromCity:
      typeof trip.fromCity === "string" && trip.fromCity.trim().length > 0
        ? trip.fromCity
        : "Unknown origin",
    toCity:
      typeof trip.toCity === "string" && trip.toCity.trim().length > 0
        ? trip.toCity
        : "Unknown destination",
    fromDate: new Date(trip.fromDate as string | number | Date),
    toDate: new Date(trip.toDate as string | number | Date),
    mode:
      typeof trip.mode === "string" && trip.mode.trim().length > 0
        ? trip.mode
        : "flight",
    budget,
    budgetMin,
    budgetMax,
    avoidActivities: normalizeStringArray(trip.avoidActivities),
    avoidLocations: normalizeStringArray(trip.avoidLocations),
    accessibilityRequirements,
  };
}
