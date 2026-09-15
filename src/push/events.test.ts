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

  it("Wed 07:00 Berlin (CEST) — second DST cron slot is a no-op", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 16, 5, 0)))).toBeNull();
  });

  it("Wed 06:15 Berlin (CET, winter) — media_day_open", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 11, 2, 5, 15)))).toBe("media_day_open");
  });

  it("Tue 06:00 Berlin — nothing due", () => {
    expect(dueEvent(new Date(Date.UTC(2026, 8, 15, 4, 0)))).toBeNull();
  });
});

describe("eventKey", () => {
  it("builds a padded, hyphenated key", () => {
    expect(eventKey("2026", 3, "reveal")).toBe("2026-w03-reveal");
  });
});
