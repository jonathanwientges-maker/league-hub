const TZ = 'Europe/Berlin';

export interface BerlinNow {
  year: number; month: number; day: number;   // month 1-12
  hour: number; minute: number;
  weekday: number;                            // 1=Mon … 7=Sun
}

const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function berlinNow(date: Date = new Date()): BerlinNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  return {
    year: +get('year'), month: +get('month'), day: +get('day'),
    hour: +get('hour'), minute: +get('minute'), weekday: WD[get('weekday')],
  };
}

/** UTC instant of the given Berlin wall-clock time (handles DST correctly). */
export function berlinWallClockToUtc(
  year: number, month: number, day: number, hour: number, minute = 0,
): Date {
  // Start with the naive UTC guess, then correct by the zone offset at that instant.
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  for (let i = 0; i < 2; i++) {                 // two passes converge across DST edges
    const b = berlinNow(guess);
    const diffMin =
      (Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute) -
       Date.UTC(year, month - 1, day, hour, minute)) / 60000;
    guess = new Date(guess.getTime() - diffMin * 60000);
  }
  return guess;
}

/** UTC instant of the NEXT Thursday 06:00 Berlin strictly after `from`. */
export function nextThursday6Utc(from: Date = new Date()): Date {
  const b = berlinNow(from);
  let daysAhead = (4 - b.weekday + 7) % 7;      // 4 = Thursday
  if (daysAhead === 0 && b.hour >= 6) daysAhead = 7;
  const base = berlinWallClockToUtc(b.year, b.month, b.day, 6, 0);
  return new Date(base.getTime() + daysAhead * 86400000);
}

const WEEKDAY_NAMES_DE = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

/** "Mittwoch, 26.08. um 06:00 Uhr" — one format for both the recurring weekly targets and any one-time special-event date. */
export function formatBerlinDateTime(date: Date): string {
  const b = berlinNow(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${WEEKDAY_NAMES_DE[b.weekday]}, ${pad(b.day)}.${pad(b.month)}. um ${pad(b.hour)}:${pad(b.minute)} Uhr`;
}
