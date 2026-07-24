import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTeams } from "../hooks/useTeams";
import { useNflState } from "../hooks/useNflState";
import { useLeagueDrafts } from "../hooks/useLeagueDrafts";
import { useSeasonContext } from "../context/SeasonContext";
import { LEAGUE_CONFIG } from "../config/league";
import type { Team } from "../domain/types";
import { useWeekContext } from "./engine/weekContext";
import { assignQuestion, assignRivalryQuestion, type AssignedQuestion } from "./engine/assignQuestion";
import { useRivalryGames } from "./useRivalryGames";
import { findRivalryGameFor } from "./rivals";
import { MEDIA_CONFIG } from "./config";
import { computeRevealAt, isVotingOpen, nextMediaDayOpenUtc, phaseFor, votingClosesAt } from "./schedule";
import {
  assignSpecialEventQuestion,
  badgeLabelForWeek,
  displayLabelForWeek,
  getActiveSpecialEvent,
  nextSpecialEventOpenAt,
  specialEventPhase,
} from "./specialEvents";
import * as api from "./api";
import type { Edition, LikeRow, MediaResponse, ResponseKind, SeasonLikeTotal } from "./api";

export type PressekonferenzPhase = "OPEN" | "PRINTING" | "CLOSED";

export function useMediaRoomLeagueId(): string {
  const { currentSeason } = useSeasonContext();
  return currentSeason?.leagueId ?? "";
}

/** Whether the identified manager has already submitted this week's media_day statement — for the homepage banner. */
export function useMediaDayStatus(rosterId: number | null) {
  const nflStateQuery = useNflState();
  const week = nflStateQuery.data?.week;

  const responseQuery = useQuery({
    queryKey: ["mediaRoom", "myResponse", MEDIA_CONFIG.season, week, rosterId, "media_day"],
    queryFn: () => api.getMyResponse(MEDIA_CONFIG.season, week as number, rosterId as number, "media_day"),
    enabled: rosterId !== null && week !== undefined,
  });

  return {
    week,
    hasSubmitted: Boolean(responseQuery.data),
    isLoading: nflStateQuery.isLoading || (rosterId !== null && responseQuery.isLoading),
  };
}

// --- Pressekonferenz ---------------------------------------------------

export function usePressekonferenz(rosterId: number | null) {
  const leagueId = useMediaRoomLeagueId();
  const teamsResult = useTeams(leagueId);
  const weekCtx = useWeekContext(leagueId);
  const rivalry = useRivalryGames(leagueId);
  const draftsQuery = useLeagueDrafts(leagueId);
  const queryClient = useQueryClient();

  const overrideMs = LEAGUE_CONFIG.draftCountdownOverride ? Date.parse(LEAGUE_CONFIG.draftCountdownOverride) : null;
  const draftStartMs = overrideMs ?? draftsQuery.data?.[0]?.start_time ?? null;

  const now = new Date();
  const specialEvent = getActiveSpecialEvent(now, draftStartMs);

  const team = rosterId !== null ? teamsResult.data?.teams.find((t) => t.rosterId === rosterId) : undefined;

  // --- special-event response (season kickoff / pre-draft / post-draft) ---
  const specialResponseQuery = useQuery({
    queryKey: ["mediaRoom", "myResponse", MEDIA_CONFIG.season, specialEvent?.week, rosterId, "media_day"],
    queryFn: () => api.getMyResponse(MEDIA_CONFIG.season, specialEvent!.week, rosterId as number, "media_day"),
    enabled: rosterId !== null && specialEvent !== null,
  });

  // --- normal weekly cycle (only relevant when no special event is active) ---
  const week = weekCtx.data?.upcomingWeek;

  const previousCategoryQuery = useQuery({
    queryKey: ["mediaRoom", "previousCategory", MEDIA_CONFIG.season, week, rosterId],
    queryFn: () => api.getMyResponse(MEDIA_CONFIG.season, (week ?? 1) - 1, rosterId as number, "media_day"),
    enabled: !specialEvent && rosterId !== null && week !== undefined && week > 1,
  });

  const myResponseQuery = useQuery({
    queryKey: ["mediaRoom", "myResponse", MEDIA_CONFIG.season, week, rosterId, "media_day"],
    queryFn: () => api.getMyResponse(MEDIA_CONFIG.season, week as number, rosterId as number, "media_day"),
    enabled: !specialEvent && rosterId !== null && week !== undefined,
  });

  const rivalryGame = !specialEvent && rosterId !== null ? findRivalryGameFor(rivalry.games, rosterId) : undefined;

  const myRivalryResponseQuery = useQuery({
    queryKey: ["mediaRoom", "myResponse", MEDIA_CONFIG.season, week, rosterId, "rivalry_statement"],
    queryFn: () =>
      api.getMyResponse(MEDIA_CONFIG.season, week as number, rosterId as number, "rivalry_statement"),
    enabled: !specialEvent && rosterId !== null && week !== undefined && Boolean(rivalryGame),
  });

  let assigned: AssignedQuestion | null = null;
  if (specialEvent && rosterId !== null && team) {
    assigned = assignSpecialEventQuestion(specialEvent.id, MEDIA_CONFIG.season, rosterId, {
      team: team.teamName,
    });
  } else if (!specialEvent && weekCtx.data && rosterId !== null) {
    assigned = assignQuestion(weekCtx.data, rosterId, previousCategoryQuery.data?.categoryId);
  }

  let rivalryAssigned: AssignedQuestion | null = null;
  if (!specialEvent && weekCtx.data && rosterId !== null && rivalryGame) {
    const opponentRosterId = rivalryGame.rosterIdA === rosterId ? rivalryGame.rosterIdB : rivalryGame.rosterIdA;
    const t = weekCtx.data.teams.get(rosterId);
    const opponent = weekCtx.data.teams.get(opponentRosterId);
    if (t && opponent) {
      rivalryAssigned = assignRivalryQuestion(MEDIA_CONFIG.season, weekCtx.data.upcomingWeek, rosterId, {
        team: t.teamName,
        opponent: opponent.teamName,
      });
    }
  }

  const submit = useCallback(
    async (kind: ResponseKind, assignedQuestion: AssignedQuestion, answer: string) => {
      if (rosterId === null) return;

      if (specialEvent) {
        const submitNow = new Date();
        await api.submitResponse(
          {
            season: MEDIA_CONFIG.season,
            week: specialEvent.week,
            rosterId,
            kind: "media_day",
            categoryId: assignedQuestion.categoryId,
            templateIndex: assignedQuestion.templateIndex,
            question: assignedQuestion.question,
            answer,
          },
          { isOpen: submitNow < specialEvent.window.submitCloseAt, revealAt: specialEvent.window.revealAt }
        );
        await queryClient.invalidateQueries({ queryKey: ["mediaRoom", "myResponse"] });
        return;
      }

      if (!weekCtx.data) return;
      await api.submitResponse({
        season: MEDIA_CONFIG.season,
        week: weekCtx.data.upcomingWeek,
        rosterId,
        kind,
        categoryId: assignedQuestion.categoryId,
        templateIndex: assignedQuestion.templateIndex,
        question: assignedQuestion.question,
        answer,
      });
      await queryClient.invalidateQueries({ queryKey: ["mediaRoom", "myResponse"] });
    },
    [specialEvent, weekCtx.data, rosterId, queryClient]
  );

  // --- unified phase/eyebrow/countdown the UI renders directly ---
  let phase: PressekonferenzPhase;
  let countdownTarget: Date;
  let eyebrow: string;

  if (specialEvent) {
    const sub = specialEventPhase(now, specialEvent.window);
    phase = sub === "OPEN" ? "OPEN" : sub === "PRINTING" ? "PRINTING" : "CLOSED";
    countdownTarget =
      sub === "PRINTING"
        ? specialEvent.window.revealAt
        : (nextSpecialEventOpenAt(now, draftStartMs) ?? nextMediaDayOpenUtc(now));
    eyebrow = `MEDIA DAY · ${(displayLabelForWeek(specialEvent.week) ?? "").toUpperCase()}`;
  } else {
    const weeklyPhase = phaseFor(now);
    phase = weeklyPhase === "MEDIA_DAY" ? "OPEN" : weeklyPhase === "PRINTING" ? "PRINTING" : "CLOSED";
    countdownTarget =
      weeklyPhase === "PRINTING"
        ? computeRevealAt(now)
        : (nextSpecialEventOpenAt(now, draftStartMs) ?? nextMediaDayOpenUtc(now));
    eyebrow = `MEDIA DAY · WOCHE ${week}`;
  }

  return {
    isLoading: teamsResult.isLoading || weekCtx.isLoading || rivalry.isLoading || draftsQuery.isLoading,
    isResponseLoading: specialEvent
      ? specialResponseQuery.isLoading
      : myResponseQuery.isLoading || myRivalryResponseQuery.isLoading,
    phase,
    countdownTarget,
    eyebrow,
    week: specialEvent ? specialEvent.week : week,
    assigned,
    rivalryAssigned,
    hasRivalryGame: specialEvent ? false : Boolean(rivalryGame),
    myResponse: specialEvent ? (specialResponseQuery.data ?? null) : (myResponseQuery.data ?? null),
    myRivalryResponse: specialEvent ? null : (myRivalryResponseQuery.data ?? null),
    submit,
    team,
  };
}

// --- Pressespiegel / Pressearchiv -------------------------------------------

export interface PressCardData {
  rosterId: number;
  kind: ResponseKind;
  teamName: string;
  avatarUrl: string | null;
  managerName: string;
  question: string;
  answer: string | null;
  responseId: string | null;
  likeCount: number;
  likedByMe: boolean;
  isQuoteOfTheWeek: boolean;
  /** "Zitat der Woche" normally, "Zitat des Tages" for the pre-/post-draft events. */
  badgeLabel: string;
}

export interface EditionWithCards {
  revealAt: string;
  week: number | null;
  cards: PressCardData[];
  votingOpen: boolean;
  votingClosed: boolean;
}

export function cardFor(
  team: Team | undefined,
  response: MediaResponse | undefined,
  likeCounts: Map<string, number>,
  likedByMe: Set<string>,
  winnerIds: Set<string>,
  fallbackRosterId: number,
  kind: ResponseKind,
  badgeLabel: string
): PressCardData {
  return {
    rosterId: team?.rosterId ?? fallbackRosterId,
    kind,
    teamName: team?.teamName ?? "?",
    avatarUrl: team?.avatarUrl ?? null,
    managerName: team?.displayName ?? "?",
    question: response?.question ?? "",
    answer: response?.answer ?? null,
    responseId: response?.id ?? null,
    likeCount: response ? likeCounts.get(response.id) ?? 0 : 0,
    likedByMe: response ? likedByMe.has(response.id) : false,
    isQuoteOfTheWeek: response ? winnerIds.has(response.id) : false,
    badgeLabel,
  };
}

/**
 * Pure assembly of every edition's press cards, like counts, and Zitat der
 * Woche winner(s) — split out from useAllEditions so it's testable without
 * mounting a query client (mirrors computeWeekContext/useWeekContext).
 */
export function computeEditionsWithCards(
  editions: Edition[],
  teams: Team[],
  likes: LikeRow[],
  rosterId: number | null,
  now: Date
): EditionWithCards[] {
  const teamsById = new Map(teams.map((t) => [t.rosterId, t]));

  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const like of likes) {
    likeCounts.set(like.responseId, (likeCounts.get(like.responseId) ?? 0) + 1);
    if (rosterId !== null && like.voterRosterId === rosterId) likedByMe.add(like.responseId);
  }

  return editions.map((edition) => {
    const revealAt = new Date(edition.revealAt);
    const votingClosed = now >= votingClosesAt(revealAt);
    const votingOpen = isVotingOpen(now, revealAt);
    const maxLikes = Math.max(0, ...edition.responses.map((r) => likeCounts.get(r.id) ?? 0));
    const winnerIds = new Set(
      votingClosed && maxLikes > 0
        ? edition.responses.filter((r) => (likeCounts.get(r.id) ?? 0) === maxLikes).map((r) => r.id)
        : []
    );

    const week = edition.responses[0]?.week ?? null;
    const badgeLabel = badgeLabelForWeek(week ?? 0);

    const mediaDayResponses = edition.responses.filter((r) => r.kind === "media_day");
    const rivalryResponses = edition.responses.filter((r) => r.kind === "rivalry_statement");

    const mediaDayCards = teams.map((team) =>
      cardFor(
        team,
        mediaDayResponses.find((r) => r.rosterId === team.rosterId),
        likeCounts,
        likedByMe,
        winnerIds,
        team.rosterId,
        "media_day",
        badgeLabel
      )
    );
    const rivalryCards = rivalryResponses.map((r) =>
      cardFor(
        teamsById.get(r.rosterId),
        r,
        likeCounts,
        likedByMe,
        winnerIds,
        r.rosterId,
        "rivalry_statement",
        badgeLabel
      )
    );

    const cards = [...mediaDayCards, ...rivalryCards].sort(
      (a, b) => Number(b.isQuoteOfTheWeek) - Number(a.isQuoteOfTheWeek)
    );

    return {
      revealAt: edition.revealAt,
      week,
      cards,
      votingOpen,
      votingClosed,
    };
  });
}

/** Every revealed edition, newest first, with press cards + like/winner state already resolved. */
export function useAllEditions(rosterId: number | null) {
  const leagueId = useMediaRoomLeagueId();
  const teamsResult = useTeams(leagueId);

  const editionsQuery = useQuery({
    queryKey: ["mediaRoom", "editions", MEDIA_CONFIG.season],
    queryFn: () => api.getRevealedWeeks(MEDIA_CONFIG.season),
  });

  const allResponseIds = (editionsQuery.data ?? []).flatMap((e) => e.responses.map((r) => r.id));

  const likesQuery = useQuery({
    queryKey: ["mediaRoom", "likes", MEDIA_CONFIG.season, allResponseIds.length],
    queryFn: () => api.getLikes(allResponseIds),
    enabled: allResponseIds.length > 0,
  });

  const teams = teamsResult.data?.teams ?? [];
  const editions = computeEditionsWithCards(
    editionsQuery.data ?? [],
    teams,
    likesQuery.data ?? [],
    rosterId,
    new Date()
  );

  return { editions, teams, isLoading: editionsQuery.isLoading || teamsResult.isLoading };
}

export function useToggleLike() {
  const queryClient = useQueryClient();
  return useCallback(
    async (card: PressCardData, rosterId: number) => {
      if (!card.responseId || card.rosterId === rosterId) return;
      if (card.likedByMe) {
        await api.removeLike(card.responseId, rosterId);
      } else {
        await api.addLike(card.responseId, rosterId);
      }
      await queryClient.invalidateQueries({ queryKey: ["mediaRoom", "likes"] });
    },
    [queryClient]
  );
}

export interface LeaderboardRow {
  rosterId: number;
  teamName: string;
  avatarUrl: string | null;
  totalLikes: number;
  quoteWins: number;
}

/** Pure aggregation of season-total likes + Zitat der Woche win counts, ranked by total likes. */
export function computeLeaderboard(
  editions: EditionWithCards[],
  teams: Team[],
  totals: SeasonLikeTotal[]
): LeaderboardRow[] {
  const qotwWins = new Map<number, number>();
  for (const edition of editions) {
    for (const card of edition.cards) {
      if (card.isQuoteOfTheWeek) qotwWins.set(card.rosterId, (qotwWins.get(card.rosterId) ?? 0) + 1);
    }
  }

  const totalsByRoster = new Map(totals.map((t) => [t.rosterId, t.totalLikes]));
  return teams
    .map((team) => ({
      rosterId: team.rosterId,
      teamName: team.teamName,
      avatarUrl: team.avatarUrl,
      totalLikes: totalsByRoster.get(team.rosterId) ?? 0,
      quoteWins: qotwWins.get(team.rosterId) ?? 0,
    }))
    .sort((a, b) => b.totalLikes - a.totalLikes);
}

export function useLeaderboard(rosterId: number | null) {
  const { editions, teams, isLoading } = useAllEditions(rosterId);

  const totalsQuery = useQuery({
    queryKey: ["mediaRoom", "seasonLikeTotals", MEDIA_CONFIG.season],
    queryFn: () => api.getSeasonLikeTotals(MEDIA_CONFIG.season),
  });

  const rows = computeLeaderboard(editions, teams, totalsQuery.data ?? []);

  return { rows, isLoading: isLoading || totalsQuery.isLoading };
}
