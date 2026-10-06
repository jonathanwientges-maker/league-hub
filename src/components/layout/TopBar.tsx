import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useLeague } from "../../hooks/useLeague";
import { useSeasonContext } from "../../context/SeasonContext";
import { LEAGUE_CONFIG } from "../../config/league";
import { NAV_ITEMS } from "./navItems";
import { SeasonSwitcher } from "./SeasonSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./TopBar.module.css";

export function TopBar() {
  const { selectedSeason } = useSeasonContext();
  const { data: league } = useLeague(selectedSeason?.leagueId ?? "");
  const avatarUrl = league?.avatar ? `https://sleepercdn.com/avatars/${league.avatar}` : null;

  // The divider is a scroll-edge fade that only appears once content is
  // actually sliding under the bar — not a permanent hairline.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={styles.topBar} data-scrolled={scrolled}>
      <NavLink to="/" className={styles.brand}>
        {avatarUrl ? (
          <img className={styles.avatar} src={avatarUrl} alt="" />
        ) : (
          <span className={styles.avatarPlaceholder} aria-hidden="true" />
        )}
        <span className={styles.leagueName}>{LEAGUE_CONFIG.displayName ?? league?.name ?? "League Hub"}</span>
      </NavLink>
      {/* Phones use the bottom tab bar instead (see BottomNav). */}
      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.actions}>
        <SeasonSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
