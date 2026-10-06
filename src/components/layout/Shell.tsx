import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { LEAGUE_CONFIG } from "../../config/league";
import { NAV_ITEMS } from "./navItems";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import styles from "./Shell.module.css";

const APP_NAME = LEAGUE_CONFIG.displayName ?? "League Hub";

const EXTRA_TITLES: [prefix: string, label: string][] = [
  ["/team/", "Team"],
  ["/history", "History"],
];

function titleFor(pathname: string): string {
  const nav = NAV_ITEMS.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  const label = pathname === "/" ? null : (nav?.label ?? EXTRA_TITLES.find(([p]) => pathname.startsWith(p))?.[1]);
  return label ? `${label} · ${APP_NAME}` : APP_NAME;
}

/** Path depth: drilling deeper slides in from the right, backing out from the left. */
function depth(pathname: string) {
  return pathname.split("/").filter(Boolean).length;
}

const PAGE_SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;

export function Shell() {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  const prevPath = useRef(pathname);

  const delta = depth(pathname) - depth(prevPath.current);
  const x = reduce ? 0 : Math.sign(delta) * 28;
  const y = reduce || delta !== 0 ? 0 : 10;

  useEffect(() => {
    prevPath.current = pathname;
    document.title = titleFor(pathname);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <TopBar />
      <main className={styles.main}>
        {/* Enter-only: the new page springs in from where it logically came
            from, and a tap during the motion is never blocked. */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, x, y }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={reduce ? { duration: 0.16 } : PAGE_SPRING}
        >
          <Outlet />
        </motion.div>
      </main>
      <BottomNav />
    </>
  );
}
