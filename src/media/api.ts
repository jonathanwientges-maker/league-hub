import { supabase } from "./supabaseClient";
import { MEDIA_CONFIG } from "./config";
import { computeRevealAt, isMediaDayOpen } from "./schedule";

export type ResponseKind = "media_day" | "rivalry_statement";

export interface MediaResponse {
  id: string;
  season: string;
  week: number;
  rosterId: number;
  kind: ResponseKind;
  categoryId: string;
  templateIndex: number;
  question: string;
  answer: string;
  revealAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ResponseRow {
  id: string;
  season: string;
  week: number;
  roster_id: number;
  kind: string;
  category_id: string;
  template_index: number;
  question: string;
  answer: string;
  reveal_at: string;
  created_at: string;
  updated_at: string;
}

function fromRow(row: ResponseRow): MediaResponse {
  return {
    id: row.id,
    season: row.season,
    week: row.week,
    rosterId: row.roster_id,
    kind: row.kind as ResponseKind,
    categoryId: row.category_id,
    templateIndex: row.template_index,
    question: row.question,
    answer: row.answer,
    revealAt: row.reveal_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Thrown for the client-side rules in Phase 6.2 — UI shows `.message` as a German toast. */
export class MediaRoomError extends Error {}

export async function getMyResponse(
  season: string,
  week: number,
  rosterId: number,
  kind: ResponseKind
): Promise<MediaResponse | null> {
  const { data, error } = await supabase
    .from("responses")
    .select("*")
    .eq("season", season)
    .eq("week", week)
    .eq("roster_id", rosterId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ResponseRow) : null;
}

export interface SubmitResponseInput {
  season: string;
  week: number;
  rosterId: number;
  kind: ResponseKind;
  categoryId: string;
  templateIndex: number;
  question: string;
  answer: string;
}

export async function submitResponse(input: SubmitResponseInput): Promise<MediaResponse> {
  if (!isMediaDayOpen()) {
    throw new MediaRoomError("Redaktionsschluss verpasst.");
  }
  if (input.answer.length > MEDIA_CONFIG.answerMaxLength) {
    throw new MediaRoomError("Maximal 280 Zeichen.");
  }

  const now = new Date();
  const row = {
    season: input.season,
    week: input.week,
    roster_id: input.rosterId,
    kind: input.kind,
    category_id: input.categoryId,
    template_index: input.templateIndex,
    question: input.question,
    answer: input.answer,
    reveal_at: computeRevealAt(now).toISOString(),
    updated_at: now.toISOString(),
  };

  const { data, error } = await supabase
    .from("responses")
    .upsert(row, { onConflict: "season,week,roster_id,kind" })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as ResponseRow);
}

export interface Edition {
  revealAt: string;
  responses: MediaResponse[];
}

/**
 * Every response whose reveal_at has already passed, grouped by reveal_at —
 * each distinct reveal_at is one "edition". The newest edition is the
 * current Pressespiegel; everything older is Pressearchiv. This replaces all
 * calendar math on the read path (Phase 6.2).
 */
export async function getRevealedWeeks(season: string): Promise<Edition[]> {
  const { data, error } = await supabase
    .from("responses")
    .select("*")
    .eq("season", season)
    .lte("reveal_at", new Date().toISOString())
    .order("reveal_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as ResponseRow[];
  const byRevealAt = new Map<string, MediaResponse[]>();
  for (const row of rows) {
    const list = byRevealAt.get(row.reveal_at) ?? [];
    list.push(fromRow(row));
    byRevealAt.set(row.reveal_at, list);
  }
  return [...byRevealAt.entries()]
    .map(([revealAt, responses]) => ({ revealAt, responses }))
    .sort((a, b) => (a.revealAt < b.revealAt ? 1 : -1));
}

export interface LikeRow {
  id: string;
  responseId: string;
  voterRosterId: number;
}

export async function getLikes(responseIds: string[]): Promise<LikeRow[]> {
  if (responseIds.length === 0) return [];
  const { data, error } = await supabase.from("likes").select("*").in("response_id", responseIds);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    responseId: row.response_id as string,
    voterRosterId: row.voter_roster_id as number,
  }));
}

/** A unique-violation (already liked) is swallowed — the UI just treats it as already-liked. */
export async function addLike(responseId: string, voterRosterId: number): Promise<void> {
  const { error } = await supabase
    .from("likes")
    .insert({ response_id: responseId, voter_roster_id: voterRosterId });
  if (error) {
    if (error.code === "23505") return;
    throw error;
  }
}

export async function removeLike(responseId: string, voterRosterId: number): Promise<void> {
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("response_id", responseId)
    .eq("voter_roster_id", voterRosterId);
  if (error) throw error;
}

export interface SeasonLikeTotal {
  rosterId: number;
  totalLikes: number;
}

export async function getSeasonLikeTotals(season: string): Promise<SeasonLikeTotal[]> {
  const { data: responses, error: responsesError } = await supabase
    .from("responses")
    .select("id, roster_id")
    .eq("season", season);
  if (responsesError) throw responsesError;

  const rosterByResponseId = new Map<string, number>(
    (responses ?? []).map((r) => [r.id as string, r.roster_id as number])
  );
  const responseIds = [...rosterByResponseId.keys()];
  if (responseIds.length === 0) return [];

  const { data: likes, error: likesError } = await supabase
    .from("likes")
    .select("response_id")
    .in("response_id", responseIds);
  if (likesError) throw likesError;

  const totals = new Map<number, number>();
  for (const like of likes ?? []) {
    const rosterId = rosterByResponseId.get(like.response_id as string);
    if (rosterId === undefined) continue;
    totals.set(rosterId, (totals.get(rosterId) ?? 0) + 1);
  }
  return [...totals.entries()].map(([rosterId, totalLikes]) => ({ rosterId, totalLikes }));
}

const MAX_RIVALS = 2;

export interface RivalsRow {
  rosterId: number;
  rivalRosterIds: number[];
}

/** Every manager's self-picked rivals for the season (used to detect rivalry games). */
export async function getAllRivals(season: string): Promise<RivalsRow[]> {
  const { data, error } = await supabase.from("rivals").select("roster_id, rival_roster_ids").eq("season", season);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    rosterId: row.roster_id as number,
    rivalRosterIds: (row.rival_roster_ids ?? []) as number[],
  }));
}

export async function getMyRivals(season: string, rosterId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from("rivals")
    .select("rival_roster_ids")
    .eq("season", season)
    .eq("roster_id", rosterId)
    .maybeSingle();
  if (error) throw error;
  return (data?.rival_roster_ids ?? []) as number[];
}

/** Upserts one manager's rival picks. The Home Page picker enforces the 2-rival cap and the pre-draft window; this is the one server-side backstop against a stale tab. */
export async function setMyRivals(
  season: string,
  rosterId: number,
  rivalRosterIds: number[]
): Promise<void> {
  if (rivalRosterIds.length > MAX_RIVALS) {
    throw new MediaRoomError("Maximal 2 Rivalen.");
  }
  const { error } = await supabase
    .from("rivals")
    .upsert(
      { season, roster_id: rosterId, rival_roster_ids: rivalRosterIds, updated_at: new Date().toISOString() },
      { onConflict: "season,roster_id" }
    );
  if (error) throw error;
}
