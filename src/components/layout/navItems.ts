export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", end: true },
  { to: "/standings", label: "Standings" },
  { to: "/playoffs", label: "Playoffs" },
  { to: "/pick-race", label: "Pick Race" },
  { to: "/media-room", label: "Media Room" },
  { to: "/rivalries", label: "Rivalries" },
  { to: "/teams", label: "Teams" },
  { to: "/history", label: "History" },
];

/** What fits on a phone tab bar; everything else lives under "More". */
export const TAB_ITEMS = NAV_ITEMS.slice(0, 4);
export const MORE_ITEMS = NAV_ITEMS.slice(4);
