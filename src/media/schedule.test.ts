import { describe, expect, it } from "vitest";
import { berlinNow, berlinWallClockToUtc } from "./berlinTime";
import {
  computeRevealAt,
  isMediaDayOpen,
  isVotingOpen,
  nextMediaDayOpenUtc,
  phaseFor,
  votingClosesAt,
} from "./schedule";

// 2026-09-02 is a Wednesday, well clear of any DST transition.
const wed = (hour: number, minute = 0) => berlinWallClockToUtc(2026, 9, 2, hour, minute);
const thu = (hour: number, minute = 0) => berlinWallClockToUtc(2026, 9, 3, hour, minute);
const fri = (hour: number, minute = 0) => berlinWallClockToUtc(2026, 9, 4, hour, minute);

describe("isMediaDayOpen / phaseFor", () => {
  it("Wed 05:59 — closed, printing (yesterday's edition already out)", () => {
    expect(isMediaDayOpen(wed(5, 59))).toBe(false);
    expect(phaseFor(wed(5, 59))).toBe("PRINTING");
  });

  it("Wed 06:00 — media day opens", () => {
    expect(isMediaDayOpen(wed(6, 0))).toBe(true);
    expect(phaseFor(wed(6, 0))).toBe("MEDIA_DAY");
  });

  it("Wed 23:59 — still media day", () => {
    expect(isMediaDayOpen(wed(23, 59))).toBe(true);
    expect(phaseFor(wed(23, 59))).toBe("MEDIA_DAY");
  });

  it("Thu 00:00 — closed, printing", () => {
    expect(isMediaDayOpen(thu(0, 0))).toBe(false);
    expect(phaseFor(thu(0, 0))).toBe("PRINTING");
  });

  it("Thu 05:59 — still printing", () => {
    expect(isMediaDayOpen(thu(5, 59))).toBe(false);
    expect(phaseFor(thu(5, 59))).toBe("PRINTING");
  });

  it("Thu 06:00 — revealed", () => {
    expect(isMediaDayOpen(thu(6, 0))).toBe(false);
    expect(phaseFor(thu(6, 0))).toBe("REVEALED");
  });

  it("Fri 06:00 — still revealed (voting window is separate from the phase)", () => {
    expect(phaseFor(fri(6, 0))).toBe("REVEALED");
  });
});

describe("computeRevealAt / votingClosesAt / isVotingOpen", () => {
  it("a submission during media day reveals this week's Thursday 06:00", () => {
    const revealAt = computeRevealAt(wed(6, 0));
    const b = berlinNow(revealAt);
    expect({ weekday: b.weekday, hour: b.hour, day: b.day }).toEqual({ weekday: 4, hour: 6, day: 3 });
  });

  it("voting is open right up to, but not including, Friday 06:00", () => {
    const revealAt = thu(6, 0);
    expect(isVotingOpen(fri(5, 59), revealAt)).toBe(true);
    expect(isVotingOpen(fri(6, 0), revealAt)).toBe(false);
    expect(votingClosesAt(revealAt).getTime()).toBe(fri(6, 0).getTime());
  });

  it("voting is not open before the reveal", () => {
    expect(isVotingOpen(wed(12, 0), thu(6, 0))).toBe(false);
  });
});

describe("nextMediaDayOpenUtc", () => {
  it("points to the same week's Wednesday 06:00 before it opens", () => {
    const b = berlinNow(nextMediaDayOpenUtc(wed(5, 59)));
    expect({ weekday: b.weekday, hour: b.hour, day: b.day }).toEqual({ weekday: 3, hour: 6, day: 2 });
  });

  it("rolls over to next week once media day has already opened", () => {
    const b = berlinNow(nextMediaDayOpenUtc(wed(6, 0)));
    expect({ weekday: b.weekday, hour: b.hour, day: b.day }).toEqual({ weekday: 3, hour: 6, day: 9 });
  });
});

describe("DST transition week (2026-10-25 fall-back)", () => {
  it("still opens media day at 06:00 Berlin wall-clock time either side of the transition", () => {
    const beforeTransition = berlinWallClockToUtc(2026, 10, 21, 6, 0); // Wed, still CEST (UTC+2)
    const afterTransition = berlinWallClockToUtc(2026, 10, 28, 6, 0); // Wed, now CET (UTC+1)

    expect(isMediaDayOpen(beforeTransition)).toBe(true);
    expect(isMediaDayOpen(afterTransition)).toBe(true);

    // The wall-clock hour is identical, but the UTC offset changed underneath it.
    expect(beforeTransition.getUTCHours()).toBe(4);
    expect(afterTransition.getUTCHours()).toBe(5);
  });

  it("computes the correct Thursday 06:00 reveal across the transition", () => {
    const submittedBefore = berlinWallClockToUtc(2026, 10, 21, 12, 0);
    const revealBefore = computeRevealAt(submittedBefore);
    expect(berlinNow(revealBefore)).toMatchObject({ year: 2026, month: 10, day: 22, hour: 6, weekday: 4 });

    const submittedAfter = berlinWallClockToUtc(2026, 10, 28, 12, 0);
    const revealAfter = computeRevealAt(submittedAfter);
    expect(berlinNow(revealAfter)).toMatchObject({ year: 2026, month: 10, day: 29, hour: 6, weekday: 4 });
  });
});
