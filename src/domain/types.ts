export interface WeeklyScore {
  week: number;
  actualPoints: number;
  optimalPoints: number; // filled in by Phase 3's potential points engine
  opponentRosterId: number | null;
  result: "W" | "L" | "T" | null;
}

export interface Team {
  rosterId: number;
  ownerId: string;
  displayName: string;
  teamName: string;
  avatarUrl: string | null;
  division: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  weeklyScores: WeeklyScore[];
  potentialPointsTotal: number; // filled in by Phase 3
}

export interface H2hRecord {
  wins: number;
  losses: number;
  ties: number;
}

/** h2hMap[rosterA][rosterB] = rosterA's record against rosterB */
export type H2hMap = Record<number, Record<number, H2hRecord>>;
