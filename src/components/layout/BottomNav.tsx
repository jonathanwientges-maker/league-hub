import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { Sheet } from "../common/Sheet";
import { MORE_ITEMS, TAB_ITEMS } from "./navItems";
import { ThemeSegmented } from "./ThemeToggle";
import styles from "./BottomNav.module.css";

const ICONS: Record<string, string> = {
  "/": "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  "/standings": "M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z",
  "/playoffs": "M3 5h6v4H3zm0 10h6v4H3zm12-5h6v4h-6zM9 7h3v10H9m3-5h3",
  "/pick-race": "M5 21V4m0 0h12l-2 4 2 4H5",
  more: "M5 12a1.6 1.6 0 1 0 0 .01zm7 0a1.6 1.6 0 1 0 0 .01zm7 0a1.6 1.6 0 1 0 0 .01z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = MORE_ITEMS.some((i) => pathname.startsWith(i.to)) || pathname.startsWith("/team");

  return (
    <>
      <nav className={styles.tabBar} aria-label="Primary">
        {TAB_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => clsx(styles.tab, isActive && styles.tabActive)}
          >
            <Icon name={item.to} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={clsx(styles.tab, moreActive && styles.tabActive)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <Icon name="more" />
          <span>More</span>
        </button>
      </nav>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className={styles.moreList}>
          {MORE_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={styles.moreLink} onClick={() => setMoreOpen(false)}>
                {item.label}
                <span aria-hidden="true">›</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <ThemeSegmented />
      </Sheet>
    </>
  );
}
