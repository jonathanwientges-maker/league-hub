import { describe, expect, it } from "vitest";
import { getCountdownParts } from "./countdown";

describe("getCountdownParts", () => {
  const now = 1_000_000;

  it("0 remaining", () => {
    expect(getCountdownParts(now, now)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("1 second remaining", () => {
    expect(getCountdownParts(now, now + 1000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
    });
  });

  it("1 day + 1 second remaining", () => {
    expect(getCountdownParts(now, now + 86400000 + 1000)).toEqual({
      days: 1,
      hours: 0,
      minutes: 0,
      seconds: 1,
    });
  });

  it("clamps to zero instead of going negative when the target is in the past", () => {
    expect(getCountdownParts(now, now - 5000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it("hours/minutes roll over correctly", () => {
    const twoHoursThirtyMin = 2 * 3600000 + 30 * 60000;
    expect(getCountdownParts(now, now + twoHoursThirtyMin)).toEqual({
      days: 0,
      hours: 2,
      minutes: 30,
      seconds: 0,
    });
  });
});
