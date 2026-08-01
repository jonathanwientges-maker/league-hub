import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { getRosters, getUsers } from "../../api/sleeper";
import { LEAGUE_ID } from "../../config/release";
import { enrichUsersWithLiveAvatars, resolveAvatarUrl } from "../../domain/team";
import { useLiveUserAvatars } from "../../hooks/useLiveAvatars";
import styles from "./RosterWall.module.css";

interface FranchiseSlot {
  rosterId: number;
  name: string;
  avatarUrl: string | null;
}

function initialsOf(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}

function AvatarCircle({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = avatarUrl && !failed ? avatarUrl : null;

  if (url) {
    return (
      <img
        className={styles.avatarImg}
        src={url}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={styles.avatarFallback} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

export function RosterWall() {
  const shouldReduceMotion = useReducedMotion();
  // No staleTime override: managers keep changing their pictures right up
  // to launch, and this page is often left open/backgrounded for days
  // rather than hard-reloaded, so every reopen/refocus should fetch fresh
  // rosters/users instead of showing whatever was cached on first load.
  const rostersQuery = useQuery({
    queryKey: ["gate", "rosters", LEAGUE_ID],
    queryFn: () => getRosters(LEAGUE_ID),
  });
  const usersQuery = useQuery({
    queryKey: ["gate", "users", LEAGUE_ID],
    queryFn: () => getUsers(LEAGUE_ID),
  });
  // Swap each member's stale league-snapshot avatar for their live account
  // picture, so a manager changing their photo before launch shows up here.
  const liveAvatarById = useLiveUserAvatars(usersQuery.data);

  // Fails/loads silently — the page must look complete without this
  // section, and we never show a stuck spinner.
  if (rostersQuery.isError || usersQuery.isError) return null;
  if (!rostersQuery.data || !usersQuery.data) return null;

  // One slot per franchise (roster), resolved to its primary owner — not one
  // slot per league member, which would show co-managers as extra/duplicate
  // franchises instead of the actual manager.
  const enrichedUsers = enrichUsersWithLiveAvatars(usersQuery.data, liveAvatarById);
  const usersById = new Map(enrichedUsers.map((user) => [user.user_id, user]));
  const franchises: FranchiseSlot[] = rostersQuery.data.slice(0, 12).map((roster) => {
    const user = usersById.get(roster.owner_id);
    return {
      rosterId: roster.roster_id,
      name: user?.metadata?.team_name || user?.display_name || "Unknown",
      avatarUrl: resolveAvatarUrl(user),
    };
  });
  if (franchises.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>12 FRANCHISES LOCKED IN</p>
      <ul className={styles.grid}>
        {franchises.map((franchise, i) => (
          <motion.li
            key={franchise.rosterId}
            className={styles.slot}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceMotion ? 0 : i * 0.06,
              duration: shouldReduceMotion ? 0 : 0.4,
            }}
          >
            <AvatarCircle avatarUrl={franchise.avatarUrl} name={franchise.name} />
            <span className={styles.name}>{franchise.name}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
