import { describe, expect, it, vi } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RosterWall } from "./RosterWall";
import * as sleeperApi from "../../api/sleeper";
import type { SleeperRoster, SleeperUser } from "../../api/types";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function user(overrides: Partial<SleeperUser>): SleeperUser {
  return {
    user_id: "u1",
    display_name: "Manager One",
    avatar: null,
    metadata: null,
    ...overrides,
  };
}

function roster(overrides: Partial<SleeperRoster>): SleeperRoster {
  return {
    roster_id: 1,
    owner_id: "u1",
    league_id: "league",
    players: [],
    starters: [],
    settings: { wins: 0, losses: 0, ties: 0, fpts: 0, fpts_decimal: 0, fpts_against: 0, fpts_against_decimal: 0 },
    ...overrides,
  };
}

describe("RosterWall", () => {
  it("renders team names for successfully fetched rosters", async () => {
    vi.spyOn(sleeperApi, "getRosters").mockResolvedValue([
      roster({ roster_id: 1, owner_id: "u1" }),
      roster({ roster_id: 2, owner_id: "u2" }),
    ]);
    vi.spyOn(sleeperApi, "getUsers").mockResolvedValue([
      user({ user_id: "u1", display_name: "Alice", metadata: { team_name: "Alice's Team" } }),
      user({ user_id: "u2", display_name: "Bob" }),
    ]);

    const { container } = renderWithClient(<RosterWall />);
    await waitFor(() => expect(container.textContent).toContain("Alice's Team"));
    expect(container.textContent).toContain("Bob");
  });

  it("resolves each franchise to its primary owner, not a co-manager", async () => {
    vi.spyOn(sleeperApi, "getRosters").mockResolvedValue([roster({ roster_id: 1, owner_id: "primary-owner" })]);
    vi.spyOn(sleeperApi, "getUsers").mockResolvedValue([
      user({ user_id: "primary-owner", display_name: "Primary Manager", metadata: { team_name: "Primary Team" } }),
      user({ user_id: "co-manager", display_name: "Co Manager" }),
    ]);

    const { container } = renderWithClient(<RosterWall />);
    await waitFor(() => expect(container.textContent).toContain("Primary Team"));
    expect(container.textContent).not.toContain("Co Manager");
  });

  it("falls back to an initials circle when an avatar image fails to load", async () => {
    vi.spyOn(sleeperApi, "getRosters").mockResolvedValue([roster({ roster_id: 1, owner_id: "u1" })]);
    vi.spyOn(sleeperApi, "getUsers").mockResolvedValue([
      user({ user_id: "u1", display_name: "Alice Smith", avatar: "broken-avatar-id" }),
    ]);

    const { container } = renderWithClient(<RosterWall />);
    const img = await waitFor(() => {
      const el = container.querySelector("img");
      if (!el) throw new Error("not rendered yet");
      return el;
    });

    fireEvent.error(img);

    await waitFor(() => expect(container.querySelector("img")).toBeNull());
    expect(container.textContent).toContain("AS"); // initials of "Alice Smith"
  });

  it("hides the whole section silently when the fetch fails", async () => {
    vi.spyOn(sleeperApi, "getRosters").mockResolvedValue([roster({ roster_id: 1, owner_id: "u1" })]);
    vi.spyOn(sleeperApi, "getUsers").mockRejectedValue(new Error("network down"));

    const { container } = renderWithClient(<RosterWall />);
    await waitFor(() => {
      // Query settles into an error state; nothing renders — no error text,
      // no spinner left behind.
      expect(container.textContent).toBe("");
    });
  });
});
