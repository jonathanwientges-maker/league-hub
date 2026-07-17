import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { getUsers } from "../../api/sleeper";
import { LEAGUE_ID } from "../../config/release";
import type { SleeperUser } from "../../api/types";
import styles from "./RosterWall.module.css";

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

function AvatarCircle({ avatarId, name }: { avatarId: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = avatarId && !failed ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : null;

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
  const usersQuery = useQuery({
    queryKey: ["gate", "users", LEAGUE_ID],
    queryFn: () => getUsers(LEAGUE_ID),
    staleTime: Infinity,
  });

  // Fails/loads silently — the page must look complete without this
  // section, and we never show a stuck spinner.
  if (usersQuery.isError) return null;
  const users: SleeperUser[] = usersQuery.data?.slice(0, 12) ?? [];
  if (users.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>12 FRANCHISES LOCKED IN</p>
      <ul className={styles.grid}>
        {users.map((user, i) => {
          const name = user.metadata?.team_name || user.display_name;
          return (
            <motion.li
              key={user.user_id}
              className={styles.slot}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: shouldReduceMotion ? 0 : i * 0.06,
                duration: shouldReduceMotion ? 0 : 0.4,
              }}
            >
              <AvatarCircle avatarId={user.avatar} name={name} />
              <span className={styles.name}>{name}</span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
