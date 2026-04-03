/**
 * Expedia Group Rapid API (US16) — lodging-centric: signature auth + property
 * content when you have a hotel `property_id` + partner keys.
 * For generic activities (kayaking, museums), we fall back to public Expedia Hotel
 * Search for the destination — no property ID required.
 *
 * Docs: https://developers.expediagroup.com/rapid/lodging/reference/signature-authentication
 */

import { createHash } from "crypto";
import { sanitizeHttpsUrl } from "@/lib/safeExternalUrl";

function expediaRapidAuthorization(apiKey: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha512")
    .update(`${apiKey}${secret}${timestamp}`)
    .digest("hex");
  return `EAN APIKey=${apiKey},Signature=${signature},timestamp=${timestamp}`;
}

function collectExpediaHttpsUrls(obj: unknown, out: string[]): void {
  if (typeof obj === "string" && obj.startsWith("https://")) {
    try {
      const host = new URL(obj).hostname.toLowerCase();
      if (host.includes("expedia.")) out.push(obj);
    } catch {
      /* ignore */
    }
  } else if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) collectExpediaHttpsUrls(v, out);
  }
}

export function pickFirstExpediaUrl(payload: unknown): string | null {
  const urls: string[] = [];
  collectExpediaHttpsUrls(payload, urls);
  return urls[0] ?? null;
}

export async function fetchExpediaPropertyPageUrl(
  apiKey: string,
  secret: string,
  baseUrl: string,
  propertyId: string,
): Promise<string | null> {
  const pid = propertyId.trim();
  if (!pid) return null;

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/v3/properties/content?language=en-US&supply_source=expedia&property_id=${encodeURIComponent(
    pid,
  )}&include=property_id,links,rooms,chain,brand`;

  const res = await fetch(url, {
    headers: {
      Authorization: expediaRapidAuthorization(apiKey.trim(), secret.trim()),
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.warn(
      "[Expedia Rapid] property content failed:",
      res.status,
      await res.text().catch(() => ""),
    );
    return null;
  }

  const json: unknown = await res.json().catch(() => null);
  return pickFirstExpediaUrl(json);
}

/**
 * When Rapid credentials or property id are missing, still surface a vendor
 * booking entry point (US16 UX) using Expedia’s consumer hotel search.
 */
export function buildExpediaHotelSearchUrl(destination: string): string {
  const q = destination.trim();
  const u = new URL("https://www.expedia.com/Hotel-Search");
  if (q) u.searchParams.set("destination", q);
  u.searchParams.set("flexibleDateSearch", "true");
  return u.toString();
}

export type ExpediaBookingResolution = {
  bookingUrl: string;
  source: "manual" | "rapid-property" | "hotel-search-fallback";
};

export function resolveExpediaBookingUrl(args: {
  activityBookingUrl?: string | null;
  destinationLabel: string;
  rapidApiKey?: string | null;
  rapidSecret?: string | null;
  rapidBaseUrl?: string | null;
  expediaPropertyId?: string | null;
}): Promise<ExpediaBookingResolution> {
  const manual = sanitizeHttpsUrl(args.activityBookingUrl);
  if (manual) {
    return Promise.resolve({
      bookingUrl: manual,
      source: "manual",
    });
  }

  const key = args.rapidApiKey?.trim();
  const secret = args.rapidSecret?.trim();
  const base =
    args.rapidBaseUrl?.trim() || "https://test.ean.com";
  const propertyId = args.expediaPropertyId?.trim();

  if (key && secret && propertyId) {
    return fetchExpediaPropertyPageUrl(key, secret, base, propertyId).then(
      (rapidUrl) => {
        if (rapidUrl)
          return {
            bookingUrl: rapidUrl,
            source: "rapid-property" as const,
          };
        return {
          bookingUrl: buildExpediaHotelSearchUrl(args.destinationLabel),
          source: "hotel-search-fallback" as const,
        };
      },
    );
  }

  return Promise.resolve({
    bookingUrl: buildExpediaHotelSearchUrl(args.destinationLabel),
    source: "hotel-search-fallback",
  });
}
