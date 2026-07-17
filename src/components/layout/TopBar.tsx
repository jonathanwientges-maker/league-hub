import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useLeague } from "../../hooks/useLeague";
import { useSeasonContext } from "../../context/SeasonContext";
import styles from "./TopBar.module.css";

const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/standings", label: "Standings" },
  { to: "/playoffs", label: "Playoffs" },
  { to: "/pick-race", label: "Pick Race" },
  { to: "/teams", label: "Teams" },
  { to: "/history", label: "History" },
];

function SeasonSwitcher() {
  const { chain, currentSeason, selectedSeason, setSelectedSeason } = useSeasonContext();

  if (chain.length === 0) return null;

  return (
    <select
      className={styles.seasonSwitcher}
      aria-label="Season"
      value={selectedSeason?.leagueId ?? ""}
      onChange={(e) => {
        const season = chain.find((ref) => ref.leagueId === e.target.value);
        if (season) setSelectedSeason(season);
      }}
    >
      {[...chain].reverse().map((season) => (
        <option key={season.leagueId} value={season.leagueId}>
          {season.season}
          {season.leagueId === currentSeason?.leagueId ? " · Live" : ""}
        </option>
      ))}
    </select>
  );
}

export function TopBar() {
  const { selectedSeason } = useSeasonContext();
  const { data: league } = useLeague(selectedSeason?.leagueId ?? "");
  const avatarUrl = league?.avatar
    ? `https://sleepercdn.com/avatars/${league.avatar}`
    : null;

  return (
    <header className={styles.topBar}>
      <NavLink to="/" className={styles.brand}>
        {avatarUrl ? (
          <img className={styles.avatar} src={avatarUrl} alt="" />
        ) : (
          <span className={styles.avatarPlaceholder} aria-hidden="true" />
        )}
        <span className={styles.leagueName}>{league?.name ?? "League Hub"}</span>
      </NavLink>
      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(styles.navLink, isActive && styles.navLinkActive)
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <SeasonSwitcher />
    </header>
  );
}
