import { describe, expect, it } from "vitest";
import { detectImageType, ImageValidationError, readDimensions, validateImageBytes } from "@/lib/image";
import { makeJpegHeader, makePng } from "../helpers";

const MB = 1024 * 1024;

describe("image validation", () => {
  it("detects PNG, JPEG and WebP by signature", () => {
    expect(detectImageType(makePng())).toBe("image/png");
    expect(detectImageType(makeJpegHeader())).toBe("image/jpeg");
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(Buffer.from("GIF89a........"))).toBeNull();
  });

  it("reads dimensions", () => {
    expect(readDimensions(makePng(64, 48), "image/png")).toEqual({ width: 64, height: 48 });
    expect(readDimensions(makeJpegHeader(100, 80), "image/jpeg")).toEqual({ width: 100, height: 80 });
  });

  it("accepts a valid image", () => {
    const v = validateImageBytes(makePng(), 5 * MB);
    expect(v.mime).toBe("image/png");
  });

  it("rejects empty, oversized, unsupported, corrupted and tiny images", () => {
    const err = (bytes: Uint8Array, max = 5 * MB) => {
      try { validateImageBytes(bytes, max); } catch (e) { return e as ImageValidationError; }
      throw new Error("expected failure");
    };
    expect(err(new Uint8Array()).status).toBe(400);
    expect(err(makePng(), 10).status).toBe(413);
    expect(err(Buffer.from("this is not an image at all")).status).toBe(415);
    expect(err(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])).message).toMatch(/corrupted/);
    expect(err(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 1, 2])).message).toMatch(/corrupted/);
    expect(err(makePng(8, 8)).message).toMatch(/dimensions/);
  });
});
