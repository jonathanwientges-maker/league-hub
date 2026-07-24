import { describe, expect, it } from "vitest";
import { cardFor, computeEditionsWithCards, computeLeaderboard } from "./roomData";
import type { EditionWithCards } from "./roomData";
import type { Team } from "../domain/types";
import type { Edition, LikeRow, MediaResponse, SeasonLikeTotal } from "./api";

function team(overrides: Partial<Team> = {}): Team {
  return {
    rosterId: 1,
    ownerId: "u1",
    displayName: "Manager A",
    teamName: "Team A",
    avatarUrl: null,
    division: 1,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    weeklyScores: [],
    potentialPointsTotal: 0,
    ...overrides,
  };
}

function response(overrides: Partial<MediaResponse> = {}): MediaResponse {
  return {
    id: "r1",
    season: "2026",
    week: 5,
    rosterId: 1,
    kind: "media_day",
    categoryId: "generic_fallback",
    templateIndex: 0,
    question: "Q?",
    answer: "An answer",
    revealAt: "2026-01-01T06:00:00Z",
    createdAt: "2025-12-31T10:00:00Z",
    updatedAt: "2025-12-31T10:00:00Z",
    ...overrides,
  };
}

describe("cardFor", () => {
  it("maps a team + response to a press card", () => {
    const t = team({ rosterId: 1, teamName: "Alpha", displayName: "Alice", avatarUrl: "a.png" });
    const r = response({ id: "resp-1", rosterId: 1, answer: "Statement text" });
    const card = cardFor(
      t,
      r,
      new Map([["resp-1", 3]]),
      new Set(["resp-1"]),
      new Set(),
      1,
      "media_day",
      "Zitat der Woche"
    );
    expect(card).toEqual({
      rosterId: 1,
      kind: "media_day",
      teamName: "Alpha",
      avatarUrl: "a.png",
      managerName: "Alice",
      question: "Q?",
      answer: "Statement text",
      responseId: "resp-1",
      likeCount: 3,
      likedByMe: true,
      isQuoteOfTheWeek: false,
      badgeLabel: "Zitat der Woche",
    });
  });

  it("renders a placeholder-safe card (null answer) when there is no response", () => {
    const t = team({ rosterId: 2, teamName: "Beta" });
    const card = cardFor(t, undefined, new Map(), new Set(), new Set(), 2, "media_day", "Zitat der Woche");
    expect(card.answer).toBeNull();
    expect(card.responseId).toBeNull();
    expect(card.likeCount).toBe(0);
    expect(card.likedByMe).toBe(false);
  });

  it("falls back to the roster id and '?' labels when the team can't be found", () => {
    const card = cardFor(
      undefined,
      undefined,
      new Map(),
      new Set(),
      new Set(),
      99,
      "rivalry_statement",
      "Zitat der Woche"
    );
    expect(card.rosterId).toBe(99);
    expect(card.teamName).toBe("?");
    expect(card.managerName).toBe("?");
  });

  it("uses 'Zitat des Tages' for the pre-/post-draft special-event weeks", () => {
    const card = cardFor(undefined, undefined, new Map(), new Set(), new Set(), 1, "media_day", "Zitat des Tages");
    expect(card.badgeLabel).toBe("Zitat des Tages");
  });
});

const NOW = new Date("2026-01-10T12:00:00Z"); // well past every fixture's revealAt + 24h voting window

describe("computeEditionsWithCards", () => {
  const teams = [
    team({ rosterId: 1, teamName: "Alpha", displayName: "Alice" }),
    team({ rosterId: 2, teamName: "Beta", displayName: "Bob" }),
  ];

  it("gives a 'no submission' card (null answer) to a manager who didn't submit", () => {
    const editions: Edition[] = [
      { revealAt: "2026-01-01T06:00:00Z", responses: [response({ id: "r1", rosterId: 1 })] },
    ];
    const [edition] = computeEditionsWithCards(editions, teams, [], null, NOW);
    const betaCard = edition.cards.find((c) => c.rosterId === 2)!;
    expect(betaCard.answer).toBeNull();
  });

  it("crowns the single highest-liked card Zitat der Woche once voting has closed", () => {
    const editions: Edition[] = [
      {
        revealAt: "2026-01-01T06:00:00Z",
        responses: [response({ id: "r1", rosterId: 1 }), response({ id: "r2", rosterId: 2 })],
      },
    ];
    const likes: LikeRow[] = [
      { id: "l1", responseId: "r1", voterRosterId: 2 },
      { id: "l2", responseId: "r2", voterRosterId: 1 },
      { id: "l3", responseId: "r2", voterRosterId: 3 },
    ];
    const [edition] = computeEditionsWithCards(editions, teams, likes, null, NOW);
    const r1Card = edition.cards.find((c) => c.responseId === "r1")!;
    const r2Card = edition.cards.find((c) => c.responseId === "r2")!;
    expect(r1Card.isQuoteOfTheWeek).toBe(false);
    expect(r2Card.isQuoteOfTheWeek).toBe(true);
  });

  it("pins the winner to the top of the card list even if it wasn't first", () => {
    const editions: Edition[] = [
      {
        revealAt: "2026-01-01T06:00:00Z",
        responses: [response({ id: "r1", rosterId: 1 }), response({ id: "r2", rosterId: 2 })],
      },
    ];
    // Team A (rosterId 1) is listed first in `teams`, but Beta's response wins on likes.
    const likes: LikeRow[] = [{ id: "l1", responseId: "r2", voterRosterId: 1 }];
    const [edition] = computeEditionsWithCards(editions, teams, likes, null, NOW);
    expect(edition.cards[0].rosterId).toBe(2);
    expect(edition.cards[0].isQuoteOfTheWeek).toBe(true);
  });

  it("crowns every tied card when likes are equal (ties all win)", () => {
    const editions: Edition[] = [
      {
        revealAt: "2026-01-01T06:00:00Z",
        responses: [response({ id: "r1", rosterId: 1 }), response({ id: "r2", rosterId: 2 })],
      },
    ];
    const likes: LikeRow[] = [
      { id: "l1", responseId: "r1", voterRosterId: 2 },
      { id: "l2", responseId: "r2", voterRosterId: 1 },
    ];
    const [edition] = computeEditionsWithCards(editions, teams, likes, null, NOW);
    expect(edition.cards.every((c) => c.isQuoteOfTheWeek)).toBe(true);
  });

  it("does not crown anyone while voting is still open, even with likes already in", () => {
    const editions: Edition[] = [
      { revealAt: NOW.toISOString(), responses: [response({ id: "r1", rosterId: 1 })] },
    ];
    const likes: LikeRow[] = [{ id: "l1", responseId: "r1", voterRosterId: 2 }];
    const [edition] = computeEditionsWithCards(editions, teams, likes, null, NOW);
    expect(edition.votingOpen).toBe(true);
    expect(edition.cards.find((c) => c.responseId === "r1")!.isQuoteOfTheWeek).toBe(false);
  });

  it("does not crown anyone once voting has closed with zero likes", () => {
    const editions: Edition[] = [
      { revealAt: "2026-01-01T06:00:00Z", responses: [response({ id: "r1", rosterId: 1 })] },
    ];
    const [edition] = computeEditionsWithCards(editions, teams, [], null, NOW);
    expect(edition.votingClosed).toBe(true);
    expect(edition.cards.some((c) => c.isQuoteOfTheWeek)).toBe(false);
  });

  it("sets likedByMe only for the given rosterId's own likes", () => {
    const editions: Edition[] = [
      { revealAt: "2026-01-01T06:00:00Z", responses: [response({ id: "r1", rosterId: 1 })] },
    ];
    const likes: LikeRow[] = [{ id: "l1", responseId: "r1", voterRosterId: 2 }];
    const [asRoster2] = computeEditionsWithCards(editions, teams, likes, 2, NOW);
    const [asRoster1] = computeEditionsWithCards(editions, teams, likes, 1, NOW);
    expect(asRoster2.cards.find((c) => c.responseId === "r1")!.likedByMe).toBe(true);
    expect(asRoster1.cards.find((c) => c.responseId === "r1")!.likedByMe).toBe(false);
  });

  it("appends rivalry_statement responses after the media_day cards", () => {
    const editions: Edition[] = [
      {
        revealAt: "2026-01-01T06:00:00Z",
        responses: [
          response({ id: "r1", rosterId: 1, kind: "media_day" }),
          response({ id: "r2", rosterId: 2, kind: "media_day" }),
          response({ id: "r3", rosterId: 1, kind: "rivalry_statement" }),
        ],
      },
    ];
    const [edition] = computeEditionsWithCards(editions, teams, [], null, NOW);
    expect(edition.cards).toHaveLength(3);
    expect(edition.cards[2].kind).toBe("rivalry_statement");
    expect(edition.cards[2].responseId).toBe("r3");
  });

  it("reads the edition's week from its responses", () => {
    const editions: Edition[] = [
      { revealAt: "2026-01-01T06:00:00Z", responses: [response({ week: 7 })] },
    ];
    const [edition] = computeEditionsWithCards(editions, teams, [], null, NOW);
    expect(edition.week).toBe(7);
  });

  it("never throws for an edition with no responses at all", () => {
    const editions: Edition[] = [{ revealAt: "2026-01-01T06:00:00Z", responses: [] }];
    expect(() => computeEditionsWithCards(editions, teams, [], null, NOW)).not.toThrow();
    const [edition] = computeEditionsWithCards(editions, teams, [], null, NOW);
    expect(edition.week).toBeNull();
  });

  it("labels a pre-draft special-event edition's cards 'Zitat des Tages'", () => {
    const editions: Edition[] = [
      { revealAt: "2026-01-01T06:00:00Z", responses: [response({ id: "r1", rosterId: 1, week: -2 })] },
    ];
    const [edition] = computeEditionsWithCards(editions, teams, [], null, NOW);
    expect(edition.cards.every((c) => c.badgeLabel === "Zitat des Tages")).toBe(true);
  });
});

describe("computeLeaderboard", () => {
  const teams = [
    team({ rosterId: 1, teamName: "Alpha" }),
    team({ rosterId: 2, teamName: "Beta" }),
    team({ rosterId: 3, teamName: "Gamma" }),
  ];

  function card(rosterId: number, isQuoteOfTheWeek: boolean): EditionWithCards["cards"][number] {
    return {
      rosterId,
      kind: "media_day",
      teamName: "?",
      avatarUrl: null,
      managerName: "?",
      question: "",
      answer: "x",
      responseId: `r${rosterId}`,
      likeCount: 0,
      likedByMe: false,
      isQuoteOfTheWeek,
      badgeLabel: "Zitat der Woche",
    };
  }

  it("ranks teams by total season likes, descending", () => {
    const totals: SeasonLikeTotal[] = [
      { rosterId: 1, totalLikes: 5 },
      { rosterId: 2, totalLikes: 12 },
    ];
    const rows = computeLeaderboard([], teams, totals);
    expect(rows.map((r) => r.rosterId)).toEqual([2, 1, 3]);
  });

  it("includes every team even with zero likes recorded", () => {
    const rows = computeLeaderboard([], teams, []);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.totalLikes === 0)).toBe(true);
  });

  it("counts Zitat der Woche wins across every edition supplied", () => {
    const editions: EditionWithCards[] = [
      { revealAt: "2026-01-01T06:00:00Z", week: 1, votingOpen: false, votingClosed: true, cards: [card(1, true), card(2, false)] },
      { revealAt: "2026-01-08T06:00:00Z", week: 2, votingOpen: false, votingClosed: true, cards: [card(1, true), card(2, false)] },
      { revealAt: "2026-01-15T06:00:00Z", week: 3, votingOpen: false, votingClosed: true, cards: [card(2, true), card(1, false)] },
    ];
    const rows = computeLeaderboard(editions, teams, []);
    const byId = new Map(rows.map((r) => [r.rosterId, r.quoteWins]));
    expect(byId.get(1)).toBe(2);
    expect(byId.get(2)).toBe(1);
    expect(byId.get(3)).toBe(0);
  });
});
