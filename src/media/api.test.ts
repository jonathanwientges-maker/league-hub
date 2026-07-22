import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above imports — vi.hoisted() lets the factory below
// reference a variable declared here without a "used before initialization" error.
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("./supabaseClient", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("./schedule", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./schedule")>();
  return { ...actual, isMediaDayOpen: vi.fn(() => true) };
});

import * as api from "./api";
import { isMediaDayOpen } from "./schedule";

/** A minimal fake PostgREST query builder: every chain method returns
 * itself, and awaiting it (or calling .single()/.maybeSingle()) resolves
 * to the configured { data, error } result — mirrors how supabase-js's
 * real builder is thenable. */
function fakeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "lte", "gte", "order", "in", "upsert", "insert", "delete"]) {
    builder[method] = chain;
  }
  builder.maybeSingle = async () => result;
  builder.single = async () => result;
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder;
}

beforeEach(() => {
  mockFrom.mockReset();
  vi.mocked(isMediaDayOpen).mockReturnValue(true);
});

describe("getMyResponse", () => {
  it("returns null when no row is found", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: null, error: null }));
    const result = await api.getMyResponse("2026", 5, 1, "media_day");
    expect(result).toBeNull();
  });

  it("maps a found row from snake_case to camelCase", async () => {
    mockFrom.mockReturnValue(
      fakeBuilder({
        data: {
          id: "id-1",
          season: "2026",
          week: 5,
          roster_id: 1,
          kind: "media_day",
          category_id: "close_win",
          template_index: 2,
          question: "Q",
          answer: "A",
          reveal_at: "2026-01-01T06:00:00Z",
          created_at: "2025-12-31T00:00:00Z",
          updated_at: "2025-12-31T00:00:00Z",
        },
        error: null,
      })
    );
    const result = await api.getMyResponse("2026", 5, 1, "media_day");
    expect(result).toEqual({
      id: "id-1",
      season: "2026",
      week: 5,
      rosterId: 1,
      kind: "media_day",
      categoryId: "close_win",
      templateIndex: 2,
      question: "Q",
      answer: "A",
      revealAt: "2026-01-01T06:00:00Z",
      createdAt: "2025-12-31T00:00:00Z",
      updatedAt: "2025-12-31T00:00:00Z",
    });
  });

  it("throws when Supabase returns an error", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: null, error: new Error("boom") }));
    await expect(api.getMyResponse("2026", 5, 1, "media_day")).rejects.toThrow("boom");
  });
});

describe("submitResponse", () => {
  const input: api.SubmitResponseInput = {
    season: "2026",
    week: 5,
    rosterId: 1,
    kind: "media_day",
    categoryId: "close_win",
    templateIndex: 0,
    question: "Q",
    answer: "A short statement",
  };

  it("rejects with a German error when media day is closed, without touching Supabase", async () => {
    vi.mocked(isMediaDayOpen).mockReturnValue(false);
    await expect(api.submitResponse(input)).rejects.toThrow("Redaktionsschluss verpasst.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects over the 280-character limit, without touching Supabase", async () => {
    await expect(api.submitResponse({ ...input, answer: "x".repeat(281) })).rejects.toThrow(
      "Maximal 280 Zeichen."
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("upserts on the unique key and returns the saved row", async () => {
    mockFrom.mockReturnValue(
      fakeBuilder({
        data: {
          id: "id-1",
          season: "2026",
          week: 5,
          roster_id: 1,
          kind: "media_day",
          category_id: "close_win",
          template_index: 0,
          question: "Q",
          answer: "A short statement",
          reveal_at: "2026-01-08T06:00:00Z",
          created_at: "2026-01-05T00:00:00Z",
          updated_at: "2026-01-05T00:00:00Z",
        },
        error: null,
      })
    );
    const result = await api.submitResponse(input);
    expect(mockFrom).toHaveBeenCalledWith("responses");
    expect(result.id).toBe("id-1");
    expect(result.answer).toBe("A short statement");
  });
});

describe("getRevealedWeeks", () => {
  it("groups responses into editions by reveal_at, newest first", async () => {
    mockFrom.mockReturnValue(
      fakeBuilder({
        data: [
          { id: "r3", season: "2026", week: 6, roster_id: 1, kind: "media_day", category_id: "c", template_index: 0, question: "Q", answer: "A", reveal_at: "2026-01-08T06:00:00Z", created_at: "x", updated_at: "x" },
          { id: "r1", season: "2026", week: 5, roster_id: 1, kind: "media_day", category_id: "c", template_index: 0, question: "Q", answer: "A", reveal_at: "2026-01-01T06:00:00Z", created_at: "x", updated_at: "x" },
          { id: "r2", season: "2026", week: 5, roster_id: 2, kind: "media_day", category_id: "c", template_index: 0, question: "Q", answer: "A", reveal_at: "2026-01-01T06:00:00Z", created_at: "x", updated_at: "x" },
        ],
        error: null,
      })
    );
    const editions = await api.getRevealedWeeks("2026");
    expect(editions).toHaveLength(2);
    expect(editions[0].revealAt).toBe("2026-01-08T06:00:00Z");
    expect(editions[0].responses).toHaveLength(1);
    expect(editions[1].revealAt).toBe("2026-01-01T06:00:00Z");
    expect(editions[1].responses).toHaveLength(2);
  });

  it("returns an empty list when nothing has been revealed yet", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: [], error: null }));
    expect(await api.getRevealedWeeks("2026")).toEqual([]);
  });
});

describe("getLikes", () => {
  it("returns an empty list without querying Supabase for an empty input", async () => {
    expect(await api.getLikes([])).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("maps like rows to camelCase", async () => {
    mockFrom.mockReturnValue(
      fakeBuilder({ data: [{ id: "l1", response_id: "r1", voter_roster_id: 2 }], error: null })
    );
    expect(await api.getLikes(["r1"])).toEqual([{ id: "l1", responseId: "r1", voterRosterId: 2 }]);
  });
});

describe("addLike", () => {
  it("silently swallows a unique-violation (already liked)", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: null, error: { code: "23505", message: "duplicate" } }));
    await expect(api.addLike("r1", 1)).resolves.toBeUndefined();
  });

  it("rethrows any other error", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: null, error: { code: "500", message: "server error" } }));
    await expect(api.addLike("r1", 1)).rejects.toMatchObject({ code: "500" });
  });
});

describe("removeLike", () => {
  it("resolves on success", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: null, error: null }));
    await expect(api.removeLike("r1", 1)).resolves.toBeUndefined();
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: null, error: new Error("nope") }));
    await expect(api.removeLike("r1", 1)).rejects.toThrow("nope");
  });
});

describe("getSeasonLikeTotals", () => {
  it("joins likes to responses and sums per roster", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "responses") {
        return fakeBuilder({
          data: [
            { id: "r1", roster_id: 1 },
            { id: "r2", roster_id: 2 },
          ],
          error: null,
        });
      }
      return fakeBuilder({
        data: [{ response_id: "r1" }, { response_id: "r1" }, { response_id: "r2" }],
        error: null,
      });
    });
    const totals = await api.getSeasonLikeTotals("2026");
    expect(totals).toEqual(
      expect.arrayContaining([
        { rosterId: 1, totalLikes: 2 },
        { rosterId: 2, totalLikes: 1 },
      ])
    );
  });

  it("short-circuits with an empty list when the season has no responses yet", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: [], error: null }));
    expect(await api.getSeasonLikeTotals("2026")).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1); // never queries "likes"
  });
});

describe("rivals", () => {
  it("getAllRivals maps rows to camelCase", async () => {
    mockFrom.mockReturnValue(
      fakeBuilder({ data: [{ roster_id: 1, rival_roster_ids: [2, 3] }], error: null })
    );
    expect(await api.getAllRivals("2026")).toEqual([{ rosterId: 1, rivalRosterIds: [2, 3] }]);
  });

  it("getMyRivals defaults to an empty array when no row exists", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: null, error: null }));
    expect(await api.getMyRivals("2026", 1)).toEqual([]);
  });

  it("setMyRivals rejects a 3rd rival without touching Supabase", async () => {
    await expect(api.setMyRivals("2026", 1, [2, 3, 4])).rejects.toThrow("Maximal 2 Rivalen.");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("setMyRivals upserts on (season, roster_id)", async () => {
    mockFrom.mockReturnValue(fakeBuilder({ data: null, error: null }));
    await expect(api.setMyRivals("2026", 1, [2, 3])).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("rivals");
  });
});
