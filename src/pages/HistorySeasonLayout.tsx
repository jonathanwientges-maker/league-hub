import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useSeasonContext, getSeasonMode } from "../context/SeasonContext";
import styles from "./HistorySeasonLayout.module.css";

export function HistorySeasonLayout() {
  const { selectedSeason, currentSeason, isLoading, error } = useSeasonContext();

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Couldn't load this season: {error.message}</p>;
  if (!selectedSeason) return <p>Season not found.</p>;

  const mode = getSeasonMode(selectedSeason);
  const isLive = selectedSeason.leagueId === currentSeason?.leagueId;

  const navItems = [
    { to: ".", label: "Overview", end: true },
    { to: "standings", label: "Standings" },
    { to: "playoffs", label: "Playoffs" },
    { to: "pick-race", label: mode === "as-played" ? "Draft Order" : "Pick Race" },
    { to: "teams", label: "Teams" },
  ];

  return (
    <div>
      <div className={styles.contextBar}>
        <span className={styles.archiveIcon} aria-hidden="true">
          🗄
        </span>
        Viewing {selectedSeason.season} season —{" "}
        {mode === "as-played" ? "as played" : "as played under league rules"}
        {isLive && " (this is also the live season)"}
      </div>

      <nav className={styles.subNav} aria-label="Season section">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) => clsx(styles.subNavLink, isActive && styles.subNavLinkActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
