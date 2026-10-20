/**
 * Removes statements that present quantitative soil measurements or exact dosages which
 * cannot be derived from a photograph (e.g. "pH 6.5", "Nitrogen is 12%", "EC: 1.2", "two bags of urea per acre").
 */
const WORD_NUM = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";
const NUM = `(?:\\d+(?:[.,]\\d+)?|${WORD_NUM})`;
const DIGIT = "\\d+(?:[.,]\\d+)?";
const PROPS =
  "nitrogen|phosphorus|phosphate|potassium|potash|calcium|magnesium|sulfur|sulphur|zinc|iron|boron|manganese|copper|molybdenum|sodium|" +
  "nitrate|ammonium|organic\\s+(?:matter|carbon)|salinity|salt\\s+content|electrical\\s+conductivity|conductivity|" +
  "cation\\s+exchange\\s+capacity|cec|ec|ph|moisture|water\\s+content|fertility|clay|sand|silt";
const QUALIFIERS = "(?:\\s+(?:level|levels|content|concentration|value|reading|index|rating|percentage|status))?";
const LINKS = "(?:\\s*(?:is|are|was|of|at|around|about|approximately|roughly|near|estimated(?:\\s+(?:at|to\\s+be))?|measured(?:\\s+at)?|reads?|~|≈|=|:|-))*";
const UNITS = "(?:kg|kilograms?|g|grams?|tons?|tonnes?|t|lbs?|pounds?|bags?|sacks?|litres?|liters?|l|ml|handfuls?|cups?|spoons?|tablespoons?|teaspoons?)";
const AREAS = "(?:hectares?|ha|acres?|plants?|trees?|square\\s*met(?:er|re)s?|m2|m²|beds?|rows?|plots?|pits?|holes?)";

const QUANTITATIVE_CLAIM_PATTERNS: RegExp[] = [
  // property followed by a value: "Nitrogen is 12", "EC: 1.2", "pH around 6.5"
  new RegExp(`\\b(?:${PROPS})\\b${QUALIFIERS}${LINKS}\\s*${DIGIT}`, "i"),
  // percentages near a soil property, in either order
  new RegExp(`\\b(?:${PROPS})\\b[^.;\\n]{0,40}?\\b${NUM}\\s*(?:%|percent|per\\s*cent)`, "i"),
  new RegExp(`\\b${NUM}\\s*(?:%|percent|per\\s*cent)[^.;\\n]{0,40}?\\b(?:${PROPS}|vwc)\\b`, "i"),
  // laboratory units
  new RegExp(`${DIGIT}\\s*(?:ppm|ppb|mg\\s*/\\s*(?:kg|l)|g\\s*/\\s*kg|kg\\s*/\\s*ha|t\\s*/\\s*ha|tons?\\s*/\\s*ha|g\\s*/\\s*m(?:2|²)|lbs?\\s*/\\s*acre|kg\\s*/\\s*acre|ds\\s*/\\s*m|ms\\s*/\\s*cm|[µu]s\\s*/\\s*cm|mmhos?|meq|cmol)`, "i"),
  // chemical abbreviations: "N: 120", "K = 80", "Na 3"
  /\b(?:N|P|K|EC|CEC|OC|OM|SOC|Na|Ca|Mg|Zn|Fe|Mn|Cu)\s*(?:is|of|at|=|:|~|≈)?\s*\d/,
  // application rates with a verb or an area: "apply two bags of urea per acre", "50 kg per hectare"
  new RegExp(`\\b(?:apply|applying|add|adding|use|using|spread|broadcast|incorporate|side-?dress|top-?dress|mix\\s+in|dose)\\b[^.;\\n]{0,40}?\\b${NUM}\\s*${UNITS}\\b`, "i"),
  new RegExp(`\\b${NUM}\\s*${UNITS}\\b[^.;\\n]{0,30}?\\b(?:per|/|an?|each)\\s*${AREAS}\\b`, "i"),
  // N-P-K grades: "10-26-26"
  /\b\d+\s*-\s*\d+\s*-\s*\d+\b/,
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
