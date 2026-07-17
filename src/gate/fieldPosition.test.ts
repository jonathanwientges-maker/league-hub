import { describe, expect, it } from "vitest";
import { computeFieldPosition } from "./fieldPosition";

describe("computeFieldPosition", () => {
  const start = 1_000_000;
  const release = start + 100_000;

  it("returns 0 at the campaign start", () => {
    expect(computeFieldPosition(start, start, release)).toBe(0);
  });

  it("returns 1 at the release moment", () => {
    expect(computeFieldPosition(release, start, release)).toBe(1);
  });

  it("returns the correct fraction partway through", () => {
    expect(computeFieldPosition(start + 25_000, start, release)).toBeCloseTo(0.25);
  });

  it("clamps to 0 before the campaign start (e.g. clock skew)", () => {
    expect(computeFieldPosition(start - 5_000, start, release)).toBe(0);
  });

  it("clamps to 1 after the release moment", () => {
    expect(computeFieldPosition(release + 50_000, start, release)).toBe(1);
  });

  it("returns 1 rather than dividing by zero/negative when start >= release", () => {
    expect(computeFieldPosition(start, start, start)).toBe(1);
    expect(computeFieldPosition(start, release, start)).toBe(1);
  });
});
