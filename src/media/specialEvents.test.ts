import { describe, expect, it } from "vitest";
import { berlinNow, berlinWallClockToUtc } from "./berlinTime";
import { RELEASE_DATE_UTC } from "../config/release";
import {
  SPECIAL_EVENT_WEEKS,
  assignSpecialEventQuestion,
  badgeLabelForWeek,
  displayLabelForWeek,
  getActiveSpecialEvent,
  nextSpecialEventOpenAt,
  postDraftWindow,
  preDraftWindow,
  seasonKickoffWindow,
  specialEventForWeek,
  specialEventPhase,
} from "./specialEvents";

describe("seasonKickoffWindow", () => {
  it("opens exactly at RELEASE_DATE_UTC", () => {
    const window = seasonKickoffWindow();
    expect(window.openAt.getTime()).toBe(Date.parse(RELEASE_DATE_UTC));
  });

  it("closes submissions Aug 25 23:59 Berlin, reveals Aug 26 06:00, crowns Aug 27 06:00", () => {
    const window = seasonKickoffWindow();
    expect(berlinNow(window.submitCloseAt)).toMatchObject({ month: 8, day: 25, hour: 23, minute: 59 });
    expect(berlinNow(window.revealAt)).toMatchObject({ month: 8, day: 26, hour: 6 });
    expect(berlinNow(window.votingCloseAt)).toMatchObject({ month: 8, day: 27, hour: 6 });
  });
});

describe("preDraftWindow", () => {
  const draftStartMs = berlinWallClockToUtc(2026, 9, 4, 18, 0).getTime();

  it("opens 3 days before, closes submissions 2 days before, reveals 1 day before, crowns exactly at draft start", () => {
    const window = preDraftWindow(draftStartMs);
    expect(window.openAt.getTime()).toBe(draftStartMs - 3 * 86400000);
    expect(window.submitCloseAt.getTime()).toBe(draftStartMs - 2 * 86400000);
    expect(window.revealAt.getTime()).toBe(draftStartMs - 1 * 86400000);
    expect(window.votingCloseAt.getTime()).toBe(draftStartMs);
  });
});

describe("postDraftWindow", () => {
  const draftStartMs = berlinWallClockToUtc(2026, 9, 4, 18, 0).getTime();

  it("opens 3h after, reveals (and closes submissions) 24h after, crowns 48h after draft start", () => {
    const window = postDraftWindow(draftStartMs);
    expect(window.openAt.getTime()).toBe(draftStartMs + 3 * 3600000);
    expect(window.revealAt.getTime()).toBe(draftStartMs + 24 * 3600000);
    expect(window.submitCloseAt.getTime()).toBe(window.revealAt.getTime());
    expect(window.votingCloseAt.getTime()).toBe(draftStartMs + 48 * 3600000);
  });
});

describe("getActiveSpecialEvent", () => {
  const draftStartMs = berlinWallClockToUtc(2026, 9, 4, 18, 0).getTime();

  it("is active for season_kickoff during its window", () => {
    const inside = new Date(Date.parse(RELEASE_DATE_UTC) + 1000);
    const active = getActiveSpecialEvent(inside, null);
    expect(active?.id).toBe("season_kickoff");
    expect(active?.week).toBe(SPECIAL_EVENT_WEEKS.season_kickoff);
  });

  it("is null before season_kickoff opens", () => {
    const before = new Date(Date.parse(RELEASE_DATE_UTC) - 1000);
    expect(getActiveSpecialEvent(before, null)).toBeNull();
  });

  it("is null for pre/post draft when no draft start time is known", () => {
    const someRandomTime = new Date("2026-09-04T16:00:00Z");
    expect(getActiveSpecialEvent(someRandomTime, null)?.id).not.toBe("pre_draft_statement");
  });

  it("is active for pre_draft_statement inside its window", () => {
    const window = preDraftWindow(draftStartMs);
    const inside = new Date(window.openAt.getTime() + 1000);
    expect(getActiveSpecialEvent(inside, draftStartMs)?.id).toBe("pre_draft_statement");
  });

  it("is active for post_draft_statement inside its window", () => {
    const window = postDraftWindow(draftStartMs);
    const inside = new Date(window.openAt.getTime() + 1000);
    expect(getActiveSpecialEvent(inside, draftStartMs)?.id).toBe("post_draft_statement");
  });

  it("is null once every window has passed", () => {
    const window = postDraftWindow(draftStartMs);
    const after = new Date(window.votingCloseAt.getTime() + 1000);
    expect(getActiveSpecialEvent(after, draftStartMs)).toBeNull();
  });

  it("prefers pre_draft_statement over season_kickoff if their windows ever overlapped", () => {
    // A pathological draft date that puts pre-draft's window on top of the kickoff window.
    const overlappingDraftStartMs = Date.parse(RELEASE_DATE_UTC) + 3 * 86400000 + 1000;
    const active = getActiveSpecialEvent(new Date(Date.parse(RELEASE_DATE_UTC) + 2000), overlappingDraftStartMs);
    expect(active?.id).toBe("pre_draft_statement");
  });
});

describe("nextSpecialEventOpenAt", () => {
  const draftStartMs = berlinWallClockToUtc(2026, 9, 4, 18, 0).getTime();

  it("finds season_kickoff's open time when nothing has started yet", () => {
    const before = new Date(Date.parse(RELEASE_DATE_UTC) - 86400000);
    const next = nextSpecialEventOpenAt(before, draftStartMs);
    expect(next?.getTime()).toBe(Date.parse(RELEASE_DATE_UTC));
  });

  it("finds post_draft_statement's open time during the gap after pre-draft ends", () => {
    const afterPreDraftEnds = new Date(draftStartMs + 1000); // draft has started
    const next = nextSpecialEventOpenAt(afterPreDraftEnds, draftStartMs);
    const postWindow = postDraftWindow(draftStartMs);
    expect(next?.getTime()).toBe(postWindow.openAt.getTime());
  });

  it("returns null once every event has opened", () => {
    const afterEverything = new Date(postDraftWindow(draftStartMs).openAt.getTime() + 1000);
    expect(nextSpecialEventOpenAt(afterEverything, draftStartMs)).toBeNull();
  });
});

describe("week <-> event mapping", () => {
  it("maps each reserved week back to its event id", () => {
    expect(specialEventForWeek(SPECIAL_EVENT_WEEKS.season_kickoff)).toBe("season_kickoff");
    expect(specialEventForWeek(SPECIAL_EVENT_WEEKS.pre_draft_statement)).toBe("pre_draft_statement");
    expect(specialEventForWeek(SPECIAL_EVENT_WEEKS.post_draft_statement)).toBe("post_draft_statement");
  });

  it("returns null for a normal season week", () => {
    expect(specialEventForWeek(5)).toBeNull();
  });

  it("labels the draft-day events 'Zitat des Tages', everything else 'Zitat der Woche'", () => {
    expect(badgeLabelForWeek(SPECIAL_EVENT_WEEKS.pre_draft_statement)).toBe("Zitat des Tages");
    expect(badgeLabelForWeek(SPECIAL_EVENT_WEEKS.post_draft_statement)).toBe("Zitat des Tages");
    expect(badgeLabelForWeek(SPECIAL_EVENT_WEEKS.season_kickoff)).toBe("Zitat der Woche");
    expect(badgeLabelForWeek(5)).toBe("Zitat der Woche");
  });

  it("gives every special event a human display label, and normal weeks none", () => {
    expect(displayLabelForWeek(SPECIAL_EVENT_WEEKS.season_kickoff)).toBe("Season Kickoff");
    expect(displayLabelForWeek(SPECIAL_EVENT_WEEKS.pre_draft_statement)).toBeTruthy();
    expect(displayLabelForWeek(SPECIAL_EVENT_WEEKS.post_draft_statement)).toBeTruthy();
    expect(displayLabelForWeek(5)).toBeNull();
  });
});

describe("specialEventPhase", () => {
  const window = seasonKickoffWindow();

  it("is OPEN before submitCloseAt", () => {
    expect(specialEventPhase(window.openAt, window)).toBe("OPEN");
  });

  it("is PRINTING between submitCloseAt and revealAt", () => {
    expect(specialEventPhase(new Date(window.submitCloseAt.getTime() + 1000), window)).toBe("PRINTING");
  });

  it("is REVEALED from revealAt onward", () => {
    expect(specialEventPhase(window.revealAt, window)).toBe("REVEALED");
    expect(specialEventPhase(new Date(window.votingCloseAt.getTime() - 1000), window)).toBe("REVEALED");
  });
});

describe("assignSpecialEventQuestion", () => {
  it("is deterministic and renders the team name for each event", () => {
    for (const id of ["season_kickoff", "pre_draft_statement", "post_draft_statement"] as const) {
      const a = assignSpecialEventQuestion(id, "2026", 1, { team: "Team A" });
      const b = assignSpecialEventQuestion(id, "2026", 1, { team: "Team A" });
      expect(a).toEqual(b);
      expect(a.categoryId).toBe(id);
      expect(a.question).toContain("Team A");
    }
  });
});
