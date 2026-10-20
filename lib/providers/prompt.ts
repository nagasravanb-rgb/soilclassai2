import { MOISTURE_CONDITIONS, SOIL_CATEGORIES } from "../schema";

export function buildSoilPrompt(city: string): string {
  return `You are a cautious soil-science assistant analysing ONE photograph of soil.
The user says the photo was taken in or near the city: ${JSON.stringify(city)}.
Treat the city ONLY as context. You have no access to weather, soil surveys, or local measurements, so never claim local soil facts.

Return ONLY JSON matching the provided schema. Rules:
- First decide whether the image actually shows soil (imageAssessment.isSoil). If not, set isSoil=false, category "undetermined", confidence 0, and keep other fields brief.
- Describe only what is directly visible in observations (colour, texture, particles/aggregates, stones/debris, organic matter indicators such as roots or dark humus-like material).
- classification.category must be one of: ${SOIL_CATEGORIES.join(", ")}. Use "mixed" when evidence suggests several textures and "undetermined" when the photo is insufficient.
- classification.confidence is your honest probability (0..1) that the category is correct from visual evidence alone. Photos rarely justify values above 0.8.
- moisture.condition must be one of: ${MOISTURE_CONDITIONS.join(", ")}. It is a visual appearance estimate; never give a percentage.
- properties: likely drainage, water-holding tendency, workability, crusting/compaction risk etc. Set basis to "visual_observation" when directly seen, otherwise "ai_prediction".
- NEVER state numeric values for pH, N, P, K, EC, salinity, organic carbon, moisture percentage, mineral concentrations, or fertility. NEVER give fertilizer products with doses or rates. NEVER say a crop is definitely suitable.
- recommendations must be general, safe, evidence-aware guidance (soil management, organic matter, water management, drainage, nutrient education) and should encourage soil testing.
- suggestedTests: concrete laboratory or field tests that would make the assessment reliable.
- uncertainty: list what limits confidence in this specific photo (lighting, wetness, scale, single surface view, etc.).
- summary: 2–3 plain-language sentences.`;
}

const str = { type: "STRING" };
const strList = { type: "ARRAY", items: str };
const conf = { type: "NUMBER" };

/** Gemini responseSchema (OpenAPI subset) mirroring ProviderResponseSchema. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    imageAssessment: {
      type: "OBJECT",
      properties: { isSoil: { type: "BOOLEAN" }, quality: { type: "STRING", enum: ["good", "fair", "poor"] }, issues: strList },
      required: ["isSoil", "quality", "issues"],
    },
    classification: {
      type: "OBJECT",
      properties: {
        category: { type: "STRING", enum: [...SOIL_CATEGORIES] },
        confidence: conf,
        alternatives: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { category: { type: "STRING", enum: [...SOIL_CATEGORIES] }, confidence: conf },
            required: ["category", "confidence"],
          },
        },
        evidence: strList,
      },
      required: ["category", "confidence", "alternatives", "evidence"],
    },
    observations: {
      type: "OBJECT",
      properties: { color: str, texture: str, particles: str, stonesDebris: str, organicMatter: str, additional: strList },
      required: ["color", "texture", "particles", "stonesDebris", "organicMatter", "additional"],
    },
    moisture: {
      type: "OBJECT",
      properties: { condition: { type: "STRING", enum: [...MOISTURE_CONDITIONS] }, evidence: str },
      required: ["condition", "evidence"],
    },
    properties: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: str, assessment: str, basis: { type: "STRING", enum: ["visual_observation", "ai_prediction"] } },
        required: ["name", "assessment", "basis"],
      },
    },
    limitations: strList,
    recommendations: {
      type: "OBJECT",
      properties: { soilManagement: strList, organicMatter: strList, waterManagement: strList, drainage: strList, nutrientEducation: strList },
      required: ["soilManagement", "organicMatter", "waterManagement", "drainage", "nutrientEducation"],
    },
    suggestedTests: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { name: str, reason: str }, required: ["name", "reason"] },
    },
    uncertainty: strList,
    summary: str,
  },
  required: [
    "imageAssessment", "classification", "observations", "moisture", "properties", "limitations",
    "recommendations", "suggestedTests", "uncertainty", "summary",
  ],
};
