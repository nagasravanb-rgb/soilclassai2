import { describe, expect, it } from "vitest";
import { validateCity } from "@/lib/validation";

describe("validateCity", () => {
  it.each(["Pune", "São Paulo", "Winston-Salem", "St. John's", "Ho Chi Minh City", "東京", "Kraków"])("accepts %s", city => {
    expect(validateCity(city)).toMatchObject({ ok: true });
  });
  it("normalises whitespace", () => {
    expect(validateCity("  New   Delhi ")).toEqual({ ok: true, city: "New Delhi" });
  });
  it.each([undefined, null, "", "   ", "a", "x".repeat(101), "<script>", "123", "Pune; DROP TABLE"])("rejects %s", city => {
    expect(validateCity(city).ok).toBe(false);
  });
});
