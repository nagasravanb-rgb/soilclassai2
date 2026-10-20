import { describe, expect, it } from "vitest";
import { containsQuantitativeClaim, guardList } from "@/lib/guard";

describe("fabrication guard", () => {
  it.each([
    "The soil pH is 6.5",
    "Soil has pH of 7",
    "Moisture content of 22%",
    "About 30% moisture",
    "Apply 50 kg/ha of urea",
    "Nitrogen 240 ppm",
    "EC 1.2 dS/m",
    "Use 10-26-26 fertilizer",
    "N: 120",
    "Nitrogen is 12%",
    "Nitrogen content estimated to be 12 %",
    "EC: 1.2",
    "Electrical conductivity is 0.8",
    "Organic matter around three percent",
    "Potassium level of 150",
    "Apply two bags of urea per acre",
    "Use 50 kg of DAP per hectare",
    "Spread 3 handfuls of fertilizer around each plant",
    "Na = 3",
    "CEC 12 cmol/kg",
  ])("flags %s", s => expect(containsQuantitativeClaim(s)).toBe(true));

  it.each([
    "Add compost to improve structure",
    "Test pH with a laboratory soil test",
    "Water deeply 1-2 times per week when dry",
    "Visible particles under 2 mm",
    "Collect 10 to 15 subsamples for a laboratory pH and nutrient test",
    "Sand grains are visible; the clay fraction cannot be estimated from a photo",
    "Retest after 2 weeks",
  ])("allows %s", s => expect(containsQuantitativeClaim(s)).toBe(false));

  it("counts removed items", () => {
    const counter = { removed: 0 };
    expect(guardList(["Add compost", "pH is 6.8"], counter)).toEqual(["Add compost"]);
    expect(counter.removed).toBe(1);
  });
});
