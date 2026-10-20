import { z } from "zod";

export const SOIL_CATEGORIES = ["sandy", "clayey", "silty", "loamy", "mixed", "undetermined"] as const;
export const MOISTURE_CONDITIONS = ["dry", "slightly_moist", "moist", "wet", "waterlogged", "undetermined"] as const;
export const DATA_SOURCES = [
  "visual_observation",
  "ai_prediction",
  "sensor_measurement",
  "laboratory_measurement",
  "not_measured",
] as const;

export type SoilCategory = (typeof SOIL_CATEGORIES)[number];
export type MoistureCondition = (typeof MOISTURE_CONDITIONS)[number];
export type DataSource = (typeof DATA_SOURCES)[number];

const text = (max = 600) => z.string().trim().max(max);
const textList = (maxItems = 8, maxLen = 400) =>
  z.array(z.string().trim().min(1).max(maxLen)).max(maxItems).default([]);
const confidence = z.number().finite().min(0).max(1);

/** Shape the AI provider is asked to return. Validated strictly before use. */
export const ProviderResponseSchema = z.object({
  imageAssessment: z.object({
    isSoil: z.boolean(),
    quality: z.enum(["good", "fair", "poor"]),
    issues: textList(6),
  }),
  classification: z.object({
    category: z.enum(SOIL_CATEGORIES),
    confidence,
    alternatives: z
      .array(z.object({ category: z.enum(SOIL_CATEGORIES), confidence }))
      .max(4)
      .default([]),
    evidence: textList(8),
  }),
  observations: z.object({
    color: text(),
    texture: text(),
    particles: text(),
    stonesDebris: text(),
    organicMatter: text(),
    additional: textList(6),
  }),
  moisture: z.object({
    condition: z.enum(MOISTURE_CONDITIONS),
    evidence: text(),
  }),
  properties: z
    .array(
      z.object({
        name: text(80).min(1),
        assessment: text(400).min(1),
        basis: z.enum(["visual_observation", "ai_prediction"]),
      }),
    )
    .max(10)
    .default([]),
  limitations: textList(8),
  recommendations: z.object({
    soilManagement: textList(6),
    organicMatter: textList(6),
    waterManagement: textList(6),
    drainage: textList(6),
    nutrientEducation: textList(6),
  }),
  suggestedTests: z
    .array(z.object({ name: text(120).min(1), reason: text(400) }))
    .max(8)
    .default([]),
  uncertainty: textList(6),
  summary: text(800).min(1),
});

export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;

const sourced = z.object({ value: text(600), source: z.enum(DATA_SOURCES) });

export const NutrientEntrySchema = z.object({
  name: text(80),
  value: z.null(),
  status: z.enum(["Not measured", "Laboratory test required"]),
  source: z.literal("not_measured"),
  note: text(400),
});

export const AnalysisResultSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  city: text(100).min(1),
  provider: z.object({ name: text(40), model: text(120), isMock: z.boolean() }),
  imageAssessment: z.object({ quality: z.enum(["good", "fair", "poor"]), issues: textList(6) }),
  classification: z.object({
    category: z.enum(SOIL_CATEGORIES),
    label: text(60),
    confidence,
    confidenceLevel: z.enum(["low", "moderate", "high"]),
    alternatives: z.array(z.object({ category: z.enum(SOIL_CATEGORIES), label: text(60), confidence })).max(4),
    evidence: textList(8),
    source: z.literal("ai_prediction"),
  }),
  observations: z.object({
    color: sourced,
    texture: sourced,
    particles: sourced,
    stonesDebris: sourced,
    organicMatter: sourced,
    additional: textList(6),
  }),
  moisture: z.object({
    condition: z.enum(MOISTURE_CONDITIONS),
    label: text(60),
    evidence: text(),
    source: z.literal("ai_prediction"),
    measuredPercent: z.null(),
    note: text(400),
  }),
  properties: z.array(z.object({ name: text(80), assessment: text(400), source: z.enum(DATA_SOURCES) })).max(10),
  limitations: textList(8),
  nutrients: z.array(NutrientEntrySchema).max(12),
  recommendations: z.object({
    soilManagement: textList(6),
    organicMatter: textList(6),
    waterManagement: textList(6),
    drainage: textList(6),
    nutrientEducation: textList(6),
    basis: z.literal("general_guidance_without_measured_data"),
  }),
  suggestedTests: z.array(z.object({ name: text(120), reason: text(400) })).max(10),
  uncertainty: textList(6),
  scientificLimitations: textList(12, 600),
  cityContext: z.object({ city: text(100), note: text(400) }),
  summary: text(800),
  removedClaims: z.number().int().min(0),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const HistoryRecordSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  city: text(100).min(1),
  category: z.enum(SOIL_CATEGORIES),
  confidence,
  summary: text(800),
  thumbnail: z
    .string()
    .max(120_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .nullable()
    .default(null),
  result: AnalysisResultSchema,
});

export type HistoryRecord = z.infer<typeof HistoryRecordSchema>;

export const CATEGORY_LABELS: Record<SoilCategory, string> = {
  sandy: "Sandy soil",
  clayey: "Clayey soil",
  silty: "Silty soil",
  loamy: "Loamy soil",
  mixed: "Mixed soil",
  undetermined: "Undetermined",
};

export const MOISTURE_LABELS: Record<MoistureCondition, string> = {
  dry: "Appears dry",
  slightly_moist: "Appears slightly moist",
  moist: "Appears moist",
  wet: "Appears wet",
  waterlogged: "Appears waterlogged",
  undetermined: "Cannot be judged from image",
};

export const SOURCE_LABELS: Record<DataSource, string> = {
  visual_observation: "Visual observation",
  ai_prediction: "AI prediction",
  sensor_measurement: "Sensor measurement",
  laboratory_measurement: "Laboratory measurement",
  not_measured: "Not measured",
};
