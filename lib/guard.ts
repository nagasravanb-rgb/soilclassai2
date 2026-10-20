/**
 * Removes statements that present quantitative soil measurements or exact dosages which
 * cannot be derived from a photograph (e.g. "pH 6.5", "20% moisture", "40 kg/ha urea").
 */
const QUANTITATIVE_CLAIM_PATTERNS: RegExp[] = [
  /\bpH\s*(?:of|is|around|about|~|=|:)?\s*\d/i,
  /\d+(?:\.\d+)?\s*(?:%|percent)\s*(?:moisture|water|vwc|organic|carbon|clay|sand|silt|nitrogen|phosphorus|potassium)/i,
  /(?:moisture|water content|organic (?:matter|carbon)|clay|sand|silt)\s*(?:content\s*)?(?:of|is|around|about|~|=|:)\s*\d/i,
  /\d+(?:\.\d+)?\s*(?:ppm|mg\s*\/\s*kg|kg\s*\/\s*ha|g\s*\/\s*m2|g\s*\/\s*m²|lbs?\s*\/\s*acre|kg\s*\/\s*acre|ds\s*\/\s*m|ms\s*\/\s*cm|µs\s*\/\s*cm|us\s*\/\s*cm|meq)/i,
  /\b(?:N|P|K)\s*[:=]\s*\d/,
  /\b\d+\s*-\s*\d+\s*-\s*\d+\b\s*(?:npk|fertili[sz]er)?/i,
];

export function containsQuantitativeClaim(statement: string): boolean {
  return QUANTITATIVE_CLAIM_PATTERNS.some(pattern => pattern.test(statement));
}

export interface GuardCounter {
  removed: number;
}

export function guardText(value: string, counter: GuardCounter, fallback = "Not determined from image"): string {
  if (!containsQuantitativeClaim(value)) return value;
  counter.removed += 1;
  return fallback;
}

export function guardList(values: string[], counter: GuardCounter): string[] {
  return values.filter(value => {
    if (!containsQuantitativeClaim(value)) return true;
    counter.removed += 1;
    return false;
  });
}
