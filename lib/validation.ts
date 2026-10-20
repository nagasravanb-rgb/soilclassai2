const CITY_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’,()-]*$/u;

export type CityValidation = { ok: true; city: string } | { ok: false; error: string };

export function validateCity(input: unknown): CityValidation {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { ok: false, error: "Please enter a city name." };
  }
  const city = input.normalize("NFC").replace(/\s+/g, " ").trim();
  if (city.length < 2 || city.length > 100) {
    return { ok: false, error: "City name must be between 2 and 100 characters." };
  }
  if (!CITY_PATTERN.test(city)) {
    return { ok: false, error: "City name can contain letters, spaces, and basic punctuation only." };
  }
  return { ok: true, city };
}
