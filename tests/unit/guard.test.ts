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
  ])("flags %s", s => expect(containsQuantitativeClaim(s)).toBe(true));

  it.each([
    "Add compost to improve structure",
    "Test pH with a laboratory soil test",
    "Water deeply 1-2 times per week when dry",
    "Visible particles under 2 mm",
  ])("allows %s", s => expect(containsQuantitativeClaim(s)).toBe(false));

  it("counts removed items", () => {
    const counter = { removed: 0 };
    expect(guardList(["Add compost", "pH is 6.8"], counter)).toEqual(["Add compost"]);
    expect(counter.removed).toBe(1);
  });
});
