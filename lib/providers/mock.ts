import type { ProviderResponse } from "../schema";
import type { AnalyzeSoilImageInput, SoilAnalysisProvider } from "./types";

/**
 * Deterministic provider for automated tests and offline demos.
 * Its output does NOT look at the image content and is always flagged `isMock`.
 */
export class MockProvider implements SoilAnalysisProvider {
  readonly name = "mock";
  readonly model = "mock-fixture-v1";
  readonly isMock = true;

  constructor(private readonly delayMs = 0) {}

  async analyzeSoilImage(_input: AnalyzeSoilImageInput): Promise<unknown> {
    if (this.delayMs > 0) await new Promise(resolve => setTimeout(resolve, this.delayMs));
    const response: ProviderResponse = {
      imageAssessment: { isSoil: true, quality: "fair", issues: ["Mock provider: image content was not analysed."] },
      classification: {
        category: "loamy",
        confidence: 0.5,
        alternatives: [{ category: "silty", confidence: 0.3 }],
        evidence: ["Mock fixture evidence — not derived from the uploaded image."],
      },
      observations: {
        color: "Mock value: medium brown",
        texture: "Mock value: crumbly aggregates",
        particles: "Mock value: mixed fine and medium particles",
        stonesDebris: "Mock value: a few small stones",
        organicMatter: "Mock value: some root fragments",
        additional: [],
      },
      moisture: { condition: "slightly_moist", evidence: "Mock value: not derived from the image." },
      properties: [
        { name: "Drainage tendency", assessment: "Mock value: moderate", basis: "ai_prediction" },
        { name: "Water-holding tendency", assessment: "Mock value: moderate", basis: "ai_prediction" },
      ],
      limitations: ["Mock value: possible surface crusting after heavy rain"],
      recommendations: {
        soilManagement: ["Avoid working the soil when it is very wet to reduce compaction."],
        organicMatter: ["Add well-decomposed compost or crop residues to build organic matter over time."],
        waterManagement: ["Check soil moisture by hand before irrigating rather than watering on a fixed schedule."],
        drainage: ["Observe whether water pools after rain; persistent pooling suggests a drainage problem."],
        nutrientEducation: ["Nitrogen, phosphorus, and potassium levels can only be known from a soil test."],
      },
      suggestedTests: [{ name: "Laboratory soil test", reason: "Measures pH and nutrients before fertilizer decisions." }],
      uncertainty: ["This is a fixed mock response used for testing."],
      summary: "DEMO RESULT from the mock provider. The uploaded image was not analysed by an AI model.",
    };
    return JSON.stringify(response);
  }
}
