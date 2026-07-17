import { describe, expect, it } from "vitest";
import { getSeasonMode } from "./SeasonContext";
import type { SeasonRef } from "../domain/seasonChain";

function season(year: string): SeasonRef {
  return { leagueId: "x", season: year, name: "x", status: "complete" };
}

describe("getSeasonMode", () => {
  it("2024 -> as-played", () => {
    expect(getSeasonMode(season("2024"))).toBe("as-played");
  });
  it("2025 -> as-played", () => {
    expect(getSeasonMode(season("2025"))).toBe("as-played");
  });
  it("2026 -> custom-rules", () => {
    expect(getSeasonMode(season("2026"))).toBe("custom-rules");
  });
  it("2027 -> custom-rules", () => {
    expect(getSeasonMode(season("2027"))).toBe("custom-rules");
  });
});
