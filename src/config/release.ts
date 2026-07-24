// The one and only source of truth for the launch moment. Store in UTC —
// the gate renders it in each visitor's local timezone.
export const RELEASE_DATE_UTC = "2026-07-24T06:55:00Z"; // Jul 24, 2026, 8:55 AM German time (CEST) — temporary pre-live test date

// The day the gate was deployed — cosmetic only, drives the field-position
// meter's starting point. Adjust if you redeploy the gate significantly
// earlier/later than this.
export const CAMPAIGN_START_UTC = "2026-07-17T00:00:00Z";

export const LEAGUE_ID = "1255212520214384640";

// If empty, the roster wall fetches the league's real name from Sleeper at
// runtime instead.
export const LEAGUE_NAME = "";
