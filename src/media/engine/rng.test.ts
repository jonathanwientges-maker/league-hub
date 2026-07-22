import { describe, expect, it } from "vitest";
import { hashSeed, mulberry32 } from "./rng";

describe("hashSeed", () => {
  it("is deterministic for the same input", () => {
    expect(hashSeed("2026-5-3")).toBe(hashSeed("2026-5-3"));
  });
  it("differs for different inputs", () => {
    expect(hashSeed("2026-5-3")).not.toBe(hashSeed("2026-5-4"));
    expect(hashSeed("2026-5-3")).not.toBe(hashSeed("2026-6-3"));
  });
});

describe("mulberry32", () => {
  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(hashSeed("2026-5-3"));
    const b = mulberry32(hashSeed("2026-5-3"));
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it("stays within [0, 1)", () => {
    const rng = mulberry32(hashSeed("seed"));
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
