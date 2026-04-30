const UNSPLASH_SEARCH = "https://api.unsplash.com/search/photos";

export type UnsplashImage = {
  url: string;
  alt?: string;
  authorName?: string;
  authorUrl?: string;
  pageUrl?: string;
};

export function buildUnsplashQuery(
  parts: Array<string | null | undefined>,
): string {
  const cleaned = parts
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .map((part) => part.trim());

  return cleaned.length > 0 ? cleaned.join(" ") : "travel";
}

export async function fetchUnsplashImage(
  query: string,
  accessKey: string,
): Promise<UnsplashImage | null> {
  const trimmedKey = accessKey.trim();
  if (!trimmedKey) return null;

  const url = new URL(UNSPLASH_SEARCH);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("order_by", "relevant");

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Authorization: `Client-ID ${trimmedKey}`,
      "Accept-Version": "v1",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.warn(
      "[unsplash] search failed:",
      response.status,
      detail.slice(0, 200),
    );
    return null;
  }

  const json = (await response.json()) as {
    results?: Array<{
      alt_description?: string | null;
      urls?: {
        regular?: string;
        full?: string;
        small?: string;
      };
      user?: {
        name?: string;
        links?: {
          html?: string;
        };
      };
      links?: {
        html?: string;
      };
    }>;
  };

  const result = Array.isArray(json.results) ? json.results[0] : undefined;
  const urlCandidate =
    result?.urls?.regular ?? result?.urls?.full ?? result?.urls?.small;

  if (!urlCandidate) return null;

  return {
    url: urlCandidate,
    alt: result?.alt_description || query,
    authorName: result?.user?.name,
    authorUrl: result?.user?.links?.html,
    pageUrl: result?.links?.html,
  };
}
