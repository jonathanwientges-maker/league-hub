import { useQueries } from "@tanstack/react-query";
import { getUser } from "../api/sleeper";
import type { SleeperUser } from "../api/types";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Sleeper's /league/{id}/users endpoint returns each member's `avatar` as a
 * STALE snapshot, frozen roughly when they joined the league — it does NOT
 * update when a manager later changes their profile picture. The live
 * account avatar lives on the per-user /user/{id} endpoint (what the Sleeper
 * app itself renders).
 *
 * This fetches that live hash for every member who has NOT set a
 * league-specific team picture (metadata.avatar) — those already win over
 * the account avatar in resolveAvatarUrl, so there's no reason to spend a
 * request refreshing them. Returns a Map of user_id -> fresh avatar hash;
 * entries only appear once their /user/{id} fetch has resolved, so callers
 * fall back to the stale value until then (progressive refresh, no blocking).
 */
export function useLiveUserAvatars(users: SleeperUser[] | undefined): Map<string, string | null> {
  const ids = (users ?? []).filter((u) => !u.metadata?.avatar).map((u) => u.user_id);

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["user", id],
      queryFn: () => getUser(id),
      staleTime: FIVE_MINUTES_MS,
      enabled: Boolean(id),
    })),
  });

  const avatarById = new Map<string, string | null>();
  queries.forEach((query, i) => {
    if (query.data) avatarById.set(ids[i], query.data.avatar ?? null);
  });
  return avatarById;
}
