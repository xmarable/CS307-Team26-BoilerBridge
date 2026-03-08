import type { IReview } from "@/models/Activity";

const POSITIVE_WORDS = new Set([
  "great", "excellent", "amazing", "love", "loved", "wonderful", "perfect",
  "fantastic", "best", "awesome", "good", "nice", "beautiful", "clean",
  "friendly", "recommend", "enjoyed", "delicious", "fresh",
]);
const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "awful", "disappointing", "poor", "worst", "dirty",
  "rude", "slow", "overpriced", "crowded", "noisy", "avoid",
]);

export interface ReviewSummary {
  averageRating: number;
  sentimentSummary: string;
  highlights: string[];
  pros: string[];
  cons: string[];
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
}

/**
 * Computes a summary from review data (no LLM - uses statistics and keywords).
 */
export function computeReviewSummary(reviews: IReview[]): ReviewSummary | null {
  if (!reviews || reviews.length === 0) {
    return null;
  }

  const ratings = reviews.map((r) => r.rating);
  const averageRating =
    ratings.reduce((a, b) => a + b, 0) / ratings.length;

  let sentimentSummary: string;
  if (averageRating >= 4) {
    sentimentSummary = "Generally positive. Reviewers recommend this place.";
  } else if (averageRating >= 2.5) {
    sentimentSummary = "Mixed reviews. Some reviewers had varying experiences.";
  } else {
    sentimentSummary = "Generally negative. Reviewers had some concerns.";
  }

  const highlights: string[] = [];
  const sortedByRating = [...reviews].sort((a, b) => b.rating - a.rating);
  for (let i = 0; i < Math.min(3, sortedByRating.length); i++) {
    const text = sortedByRating[i].text?.trim();
    if (text) {
      const snippet = text.length > 80 ? text.slice(0, 80).trim() + "…" : text;
      highlights.push(snippet);
    }
  }

  const prosSet = new Set<string>();
  const consSet = new Set<string>();
  for (const r of reviews) {
    const tokens = tokenize(r.text);
    for (const t of tokens) {
      if (POSITIVE_WORDS.has(t)) prosSet.add(t.charAt(0).toUpperCase() + t.slice(1));
      if (NEGATIVE_WORDS.has(t)) consSet.add(t.charAt(0).toUpperCase() + t.slice(1));
    }
  }
  const pros = Array.from(prosSet).slice(0, 5);
  const cons = Array.from(consSet).slice(0, 5);

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    sentimentSummary,
    highlights,
    pros: pros.length > 0 ? pros : (averageRating >= 4 ? ["Well-rated by reviewers"] : []),
    cons: cons.length > 0 ? cons : (averageRating < 3 ? ["Consider reading individual reviews"] : []),
  };
}
