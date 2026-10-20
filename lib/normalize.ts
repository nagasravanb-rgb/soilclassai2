import { guardList, guardText, type GuardCounter } from "./guard";
import {
  CATEGORY_LABELS,
  MOISTURE_LABELS,
  type AnalysisResult,
  type ProviderResponse,
} from "./schema";

export const SCIENTIFIC_LIMITATIONS: string[] = [
  "This analysis is based only on a photograph. Results are AI-generated visual interpretations, not laboratory measurements.",
  "A photograph cannot measure soil pH, nitrogen, phosphorus, potassium, electrical conductivity, salinity, mineral concentrations, or fertility.",
  "Moisture is a visual estimate of surface appearance only. Accurate moisture values require a calibrated soil-moisture sensor or gravimetric test.",
  "Soil texture class (sand/silt/clay proportions) can only be confirmed by a hand-texture test performed by a trained person or by laboratory particle-size analysis.",
  "Lighting, camera settings, shadows, recent rain or irrigation, and surface crusts can change how soil looks.",
  "The confidence score reflects the AI model's own uncertainty about the visual classification. It is not a measure of scientific accuracy.",
  "The city name is used as context only. No live weather, regional soil-survey, or local measurement data is used.",
];

const NUTRIENTS: Array<{ name: string; status: "Not measured" | "Laboratory test required"; note: string }> = [
  { name: "Soil pH", status: "Laboratory test required", note: "Measure with a calibrated pH meter or a laboratory soil test." },
  { name: "Nitrogen (N)", status: "Laboratory test required", note: "Requires a laboratory soil test; nitrogen levels change over time." },
  { name: "Phosphorus (P)", status: "Laboratory test required", note: "Requires a laboratory soil test using a method suited to your region." },
  { name: "Potassium (K)", status: "Laboratory test required", note: "Requires a laboratory soil test." },
  { name: "Organic carbon", status: "Laboratory test required", note: "Darker colour can suggest organic matter, but the amount must be measured in a laboratory." },
  { name: "Electrical conductivity / salinity", status: "Laboratory test required", note: "Requires an EC meter or a laboratory test." },
  { name: "Micronutrients (Zn, Fe, Mn, Cu, B)", status: "Laboratory test required", note: "Requires a laboratory soil test." },
  { name: "Measured moisture content", status: "Not measured", note: "Requires a soil-moisture sensor or gravimetric (oven-dry) test." },
];

const DEFAULT_TESTS = [
  { name: "Standard laboratory soil test (pH, N, P, K, organic carbon, EC)", reason: "Needed before making any fertilizer or amendment decisions." },
  { name: "Hand-texture (ribbon) test or laboratory particle-size analysis", reason: "Confirms the sand/silt/clay class suggested by the photo." },
];

export function confidenceLevel(value: number): "low" | "moderate" | "high" {
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "moderate";
  return "low";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface NormalizeMeta {
  id: string;
  createdAt: string;
  city: string;
  provider: { name: string; model: string; isMock: boolean };
}

/** Converts a validated provider response into the app's stable result schema. */
export function normalizeAnalysisResult(raw: ProviderResponse, meta: NormalizeMeta): AnalysisResult {
  const counter: GuardCounter = { removed: 0 };
  const t = (value: string) => guardText(value || "Not determined from image", counter);
  const l = (values: string[]) => guardList(values, counter);

  const category = raw.imageAssessment.quality === "poor" && raw.classification.confidence < 0.3
    ? "undetermined"
    : raw.classification.category;
  const conf = round2(raw.classification.confidence);

  const testNames = new Set<string>();
  const suggestedTests = [...raw.suggestedTests, ...DEFAULT_TESTS]
    .filter(test => !guardTestDuplicate(test.name, testNames))
    .map(test => ({ name: t(test.name), reason: t(test.reason) }))
    .slice(0, 10);

  return {
    id: meta.id,
    createdAt: meta.createdAt,
    city: meta.city,
    provider: meta.provider,
    imageAssessment: { quality: raw.imageAssessment.quality, issues: l(raw.imageAssessment.issues) },
    classification: {
      category,
      label: CATEGORY_LABELS[category],
      confidence: conf,
      confidenceLevel: confidenceLevel(conf),
      alternatives: raw.classification.alternatives
        .filter(alt => alt.category !== category)
        .map(alt => ({ category: alt.category, label: CATEGORY_LABELS[alt.category], confidence: round2(alt.confidence) })),
      evidence: l(raw.classification.evidence),
      source: "ai_prediction",
    },
    observations: {
      color: { value: t(raw.observations.color), source: "visual_observation" },
      texture: { value: t(raw.observations.texture), source: "visual_observation" },
      particles: { value: t(raw.observations.particles), source: "visual_observation" },
      stonesDebris: { value: t(raw.observations.stonesDebris), source: "visual_observation" },
      organicMatter: { value: t(raw.observations.organicMatter), source: "visual_observation" },
      additional: l(raw.observations.additional),
    },
    moisture: {
      condition: raw.moisture.condition,
      label: MOISTURE_LABELS[raw.moisture.condition],
      evidence: t(raw.moisture.evidence),
      source: "ai_prediction",
      measuredPercent: null,
      note: "Visual estimate of surface appearance only — not a measured moisture percentage.",
    },
    properties: raw.properties
      .map(p => ({ name: p.name, assessment: guardText(p.assessment, counter, ""), source: p.basis }))
      .filter(p => p.assessment.length > 0),
    limitations: l(raw.limitations),
    nutrients: NUTRIENTS.map(n => ({ ...n, value: null, source: "not_measured" as const })),
    recommendations: {
      soilManagement: l(raw.recommendations.soilManagement),
      organicMatter: l(raw.recommendations.organicMatter),
      waterManagement: l(raw.recommendations.waterManagement),
      drainage: l(raw.recommendations.drainage),
      nutrientEducation: l(raw.recommendations.nutrientEducation),
      basis: "general_guidance_without_measured_data",
    },
    suggestedTests,
    uncertainty: l(raw.uncertainty),
    scientificLimitations: SCIENTIFIC_LIMITATIONS,
    cityContext: {
      city: meta.city,
      note: "Used as context only. No live weather, local soil-survey, or regional measurement data is integrated, so no local soil properties are claimed.",
    },
    summary: guardText(raw.summary, counter, "AI visual interpretation of the soil photo. See details below."),
    removedClaims: counter.removed,
  };
}

function guardTestDuplicate(name: string, seen: Set<string>): boolean {
  const key = name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 24);
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
}
