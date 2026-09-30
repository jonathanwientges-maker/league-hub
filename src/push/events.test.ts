import { describe, expect, it } from "vitest";
import { dueEvent, eventKey } from "./events";

describe("dueEvent", () => {
  it("Wed 06:30 Berlin (CEST) — media_day_open", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 16, 4, 30)))).toBe("media_day_open");
  });

  it("Wed 18:05 Berlin (CEST) — media_day_last_call", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 16, 16, 5)))).toBe("media_day_last_call");
  });

  it("Thu 06:10 Berlin (CEST) — reveal", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 17, 4, 10)))).toBe("reveal");
  });

  it("Wed 07:00 Berlin (CEST) — second DST cron slot still matches media_day_open (whole-window, not exact-hour)", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 16, 5, 0)))).toBe("media_day_open");
  });

  it("Wed 06:15 Berlin (CET, winter) — media_day_open", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 11, 2, 5, 15)))).toBe("media_day_open");
  });

  it("Tue 06:00 Berlin — nothing due", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 15, 4, 0)))).toBeNull();
  });

  // Regression coverage for the actual bug: GitHub Actions' schedule trigger
  // has been observed landing 5-7h late on this repo, which the old
  // exact-hour dueEvent() silently swallowed as "nothing due" — see this
  // function's doc comment.
  it("Wed 11:00 Berlin — a run delayed 5h past the 06:00 open window still fires media_day_open", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 16, 9, 0)))).toBe("media_day_open");
  });

  it("Wed 17:59 Berlin — the instant before last call still resolves to media_day_open, not last_call", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 16, 15, 59)))).toBe("media_day_open");
  });

  it("Wed 23:30 Berlin — a run delayed past 18:00 still fires media_day_last_call", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 16, 21, 30)))).toBe("media_day_last_call");
  });

  it("Wed 23:59 Berlin — the instant before midnight is still media_day_last_call, never rolls into Thursday's reveal window", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 16, 21, 59)))).toBe("media_day_last_call");
  });

  it("Thu 14:00 Berlin — a run delayed well past 06:00 still fires reveal", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 17, 12, 0)))).toBe("reveal");
  });

  it("Thu 05:59 Berlin — the instant before the reveal window opens is still nothing due", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 17, 3, 59)))).toBeNull();
  });
});

describe("eventKey", () => {
  it("builds a padded, hyphenated key", () => {
    expect(eventKey("2026", 3, "reveal")).toBe("2026-w03-reveal");
  });
});
