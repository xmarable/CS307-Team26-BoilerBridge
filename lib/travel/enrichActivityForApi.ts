import Activity from "@/models/Activity";
import { sanitizeHttpsUrl } from "@/lib/safeExternalUrl";
import { fetchGooglePlaceEnrichment } from "./googlePlaces";
import { resolveExpediaBookingUrl } from "./expediaRapid";
import { buildBookingPlan, deriveHintTags, type BookingPlan } from "./bookingIntel";

export type GooglePlacePayload = {
  placeId: string;
  displayName?: string;
  rating?: number;
  userRatingCount?: number;
  reviews: { text: string; rating: number; author?: string }[];
  googleMapsUri?: string;
  types?: string[];
  priceLevel?: number;
  nationalPhoneNumber?: string;
  weekdayDescriptions?: string[];
};

export type ActivityLeanForEnrichment = {
  /** Omit for place preview (Google-only, not persisted). */
  _id?: unknown;
  placeId?: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  estimatedCost?: number;
  infoUrl?: string;
  description?: string;
  referenceLinks?: { title: string; url: string }[];
  bookingUrl?: string;
  expediaPropertyId?: string;
  googleMapsUri?: string;
  googleTypes?: string[];
  priceLevel?: number;
  phoneNumber?: string;
  openingHoursSummary?: string;
  googlePhotoReference?: string;
  googlePhotoMediaResource?: string;
};

function serializeId(id: unknown): string {
  if (id && typeof (id as { toString: () => string }).toString === "function") {
    return (id as { toString: () => string }).toString();
  }
  return String(id);
}

function formatPriceLevel(n: number | undefined | null): string | undefined {
  if (n == null || typeof n !== "number" || n < 0 || n > 4) return undefined;
  if (n === 0) return "Free";
  return "$".repeat(n);
}

function shortSummaryFromDescription(text: string | undefined, max = 200): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/**
 * Merge Google Places (US15) and Expedia Rapid / search fallback (US16)
 * into the payload returned by GET /api/activities/[activityId].
 */
export async function enrichActivityForApi(activity: ActivityLeanForEnrichment) {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  let google = null;
  if (googleKey) {
    try {
      google = await fetchGooglePlaceEnrichment(googleKey, {
        placeId: activity.placeId,
        fallbackTextQuery: activity.placeId?.trim()
          ? null
          : [activity.name, activity.address].filter(Boolean).join(", "),
      });
    } catch (e) {
      console.warn("[Google Places] enrichment error", e);
    }
  }

  if (google && activity._id != null && String(activity._id).length > 0) {
    const toSet: Record<string, string> = {};
    if (
      google.googlePhotoMediaResource?.trim() &&
      !activity.googlePhotoMediaResource?.trim()
    ) {
      toSet.googlePhotoMediaResource = google.googlePhotoMediaResource.trim();
    }
    if (
      google.googlePhotoReference?.trim() &&
      !activity.googlePhotoReference?.trim()
    ) {
      toSet.googlePhotoReference = google.googlePhotoReference.trim();
    }
    if (Object.keys(toSet).length) {
      await Activity.updateOne({ _id: activity._id }, { $set: toSet });
      Object.assign(activity, toSet);
    }
  }

  const referenceLinks = [...(activity.referenceLinks ?? [])];
  const mapsUri = google?.googleMapsUri?.trim() || activity.googleMapsUri?.trim();
  if (mapsUri && !referenceLinks.some((r) => r.url === mapsUri)) {
    referenceLinks.push({ title: "Google Maps", url: mapsUri });
  }

  const description =
    activity.description?.trim() || google?.editorialSummary?.trim() || undefined;
  const address =
    activity.address?.trim() || google?.formattedAddress?.trim() || undefined;
  const infoUrl =
    activity.infoUrl?.trim() || google?.websiteUri?.trim() || undefined;

  const destinationLabel = [activity.name, address].filter(Boolean).join(" · ");

  const expedia = await resolveExpediaBookingUrl({
    activityBookingUrl: activity.bookingUrl,
    destinationLabel: destinationLabel || activity.name,
    rapidApiKey: process.env.EXPEDIA_RAPID_API_KEY,
    rapidSecret: process.env.EXPEDIA_RAPID_SECRET,
    rapidBaseUrl: process.env.EXPEDIA_RAPID_BASE_URL,
    expediaPropertyId: activity.expediaPropertyId,
  });

  const mergedTypes =
    (google?.types?.length ? google.types : undefined) ??
    activity.googleTypes ??
    [];

  const bookingPlan: BookingPlan = buildBookingPlan({
    name: activity.name,
    address,
    infoUrl,
    manualBookingUrl: sanitizeHttpsUrl(activity.bookingUrl),
    googleMapsUri: mapsUri || null,
    googleTypes: mergedTypes.length ? mergedTypes : null,
    expediaUrl: expedia.bookingUrl,
    expediaSource: expedia.source,
  });

  const phone =
    google?.nationalPhoneNumber?.trim() || activity.phoneNumber?.trim();
  if (phone) {
    const telDigits = phone.replace(/[^\d+]/g, "");
    const telHref = telDigits.length > 0 ? `tel:${telDigits}` : "";
    if (
      telHref &&
      !bookingPlan.secondaries.some(
        (s) => s.url === telHref || s.id === "call_venue",
      ) &&
      !bookingPlan.primary?.url?.includes("tel:")
    ) {
      bookingPlan.secondaries.push({
        id: "call_venue",
        label: "Call venue",
        url: telHref,
        kind: "official",
        description: phone,
      });
    }
  }

  const priceLevel =
    google?.priceLevel != null ? google.priceLevel : activity.priceLevel;
  const openingHoursLines =
    google?.weekdayDescriptions?.length && google.weekdayDescriptions
      ? google.weekdayDescriptions
      : activity.openingHoursSummary?.split("\n").filter((l) => l.trim()) ?? [];

  const displayRating =
    typeof google?.rating === "number" ? google.rating : activity.rating ?? null;
  const displayReviewCount =
    typeof google?.userRatingCount === "number"
      ? google.userRatingCount
      : activity.reviewCount ?? 0;

  const googlePlace: GooglePlacePayload | undefined = google
    ? {
        placeId: google.placeId,
        displayName: google.displayName,
        rating: google.rating,
        userRatingCount: google.userRatingCount,
        reviews: google.reviews.map((r) => ({
          text: r.text,
          rating: r.rating,
          author: r.author,
        })),
        googleMapsUri: google.googleMapsUri,
        types: google.types,
        priceLevel: google.priceLevel,
        nationalPhoneNumber: google.nationalPhoneNumber,
        weekdayDescriptions: google.weekdayDescriptions,
      }
    : undefined;

  const hasMongoId = activity._id != null && String(activity._id).length > 0;
  const idStr = hasMongoId ? serializeId(activity._id) : "";
  const isPreview = !hasMongoId;

  const resolvedName = hasMongoId
    ? activity.name
    : google?.displayName?.trim() || activity.name?.trim() || "Place";

  const hasHeroPhoto = hasMongoId
    ? Boolean(
        activity.googlePhotoMediaResource?.trim() ||
          activity.googlePhotoReference?.trim(),
      )
    : Boolean(
        google?.googlePhotoMediaResource?.trim() ||
          google?.googlePhotoReference?.trim(),
      );

  let heroImageUrl: string | undefined;
  if (hasHeroPhoto) {
    if (hasMongoId) {
      heroImageUrl = `/api/activities/${idStr}/hero-image`;
    } else if (activity.placeId?.trim()) {
      heroImageUrl = `/api/activities/preview/hero-image?placeId=${encodeURIComponent(activity.placeId.trim())}`;
    }
  }

  let budgetNote: string | undefined;
  if (activity.estimatedCost != null) {
    budgetNote = `This place lists an estimated cost of about $${activity.estimatedCost}. Compare that with your trip budget before you commit.`;
  }

  return {
    activity: {
      _id: idStr,
      isPreview,
      placeId: activity.placeId,
      name: resolvedName,
      address,
      rating: displayRating,
      reviewCount: displayReviewCount,
      estimatedCost: activity.estimatedCost,
      infoUrl,
      description,
      shortSummary: shortSummaryFromDescription(description),
      referenceLinks,
      bookingUrl: sanitizeHttpsUrl(expedia.bookingUrl) ?? undefined,
      expediaSource: expedia.source,
      googlePlace,
      types: mergedTypes.length ? mergedTypes : undefined,
      priceLevel: priceLevel != null ? priceLevel : undefined,
      priceLevelLabel: formatPriceLevel(priceLevel ?? null),
      phoneNumber: phone,
      openingHours: openingHoursLines.length ? openingHoursLines : undefined,
      hintTags: deriveHintTags(mergedTypes),
      bookingPlan,
      budgetNote,
      heroImageUrl,
    },
  };
}
