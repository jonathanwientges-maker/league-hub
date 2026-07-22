import { MEDIA_CONFIG } from "../config";
import { TEMPLATES, renderTemplate } from "../templates";
import { hashSeed, mulberry32 } from "./rng";
import { CATEGORIES, type MediaCategory } from "./categories";
import type { WeekContext } from "./weekContext";

export interface AssignedQuestion {
  categoryId: string;
  templateIndex: number;
  question: string;
}

function weightedPick(
  eligible: { category: MediaCategory; payload: Record<string, string | number> }[],
  rng: () => number
): { category: MediaCategory; payload: Record<string, string | number> } {
  const totalWeight = eligible.reduce((sum, e) => sum + e.category.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of eligible) {
    roll -= entry.category.weight;
    if (roll <= 0) return entry;
  }
  return eligible[eligible.length - 1];
}

/**
 * Deterministic: same (season, week, rosterId) always assigns the same
 * category and template, on every device/reload. No Math.random() anywhere.
 */
export function assignQuestion(
  ctx: WeekContext,
  rosterId: number,
  previousCategoryId?: string
): AssignedQuestion {
  if (ctx.upcomingWeek <= MEDIA_CONFIG.thresholds.seasonKickoffMaxWeek) {
    const team = ctx.teams.get(rosterId);
    return assignSeasonKickoffQuestion(ctx.season, ctx.upcomingWeek, rosterId, {
      team: team?.teamName ?? "?",
    });
  }

  let eligible = CATEGORIES.map((category) => ({
    category,
    payload: category.appliesTo(ctx, rosterId),
  })).filter((e): e is { category: MediaCategory; payload: Record<string, string | number> } => e.payload !== false);

  if (eligible.length === 0) {
    const fallback = CATEGORIES.find((c) => c.id === "generic_fallback")!;
    const payload = fallback.appliesTo(ctx, rosterId);
    eligible = [{ category: fallback, payload: payload === false ? {} : payload }];
  }

  if (previousCategoryId && eligible.length > 1) {
    const withoutPrevious = eligible.filter((e) => e.category.id !== previousCategoryId);
    if (withoutPrevious.length > 0) eligible = withoutPrevious;
  }

  const seedBase = `${ctx.season}-${ctx.upcomingWeek}-${rosterId}`;
  const categoryRng = mulberry32(hashSeed(seedBase));
  const chosen = weightedPick(eligible, categoryRng);

  const templates = TEMPLATES[chosen.category.id] ?? [];
  const templateRng = mulberry32(hashSeed(`${seedBase}-${chosen.category.id}`));
  const templateIndex =
    templates.length > 0 ? Math.floor(templateRng() * templates.length) : 0;
  const template = templates[templateIndex] ?? "";

  return {
    categoryId: chosen.category.id,
    templateIndex,
    question: renderTemplate(template, chosen.payload),
  };
}

/**
 * The season_kickoff override assignQuestion falls back to before any real
 * week has been played — same deterministic scheme, single-template pool.
 */
export function assignSeasonKickoffQuestion(
  season: string,
  week: number,
  rosterId: number,
  payload: Record<string, string | number>
): AssignedQuestion {
  const templates = TEMPLATES["season_kickoff"] ?? [];
  const rng = mulberry32(hashSeed(`${season}-${week}-${rosterId}-season_kickoff`));
  const templateIndex = templates.length > 0 ? Math.floor(rng() * templates.length) : 0;
  const template = templates[templateIndex] ?? "";

  return {
    categoryId: "season_kickoff",
    templateIndex,
    question: renderTemplate(template, payload),
  };
}

/**
 * Same deterministic scheme as assignQuestion, but for the single-category
 * rivalry_statement pool (Phase 9.3) — seeded with a "-rivalry" suffix so it
 * never collides with the manager's regular media_day pick for the week.
 */
export function assignRivalryQuestion(
  season: string,
  week: number,
  rosterId: number,
  payload: Record<string, string | number>
): AssignedQuestion {
  const templates = TEMPLATES["rivalry_statement"] ?? [];
  const rng = mulberry32(hashSeed(`${season}-${week}-${rosterId}-rivalry`));
  const templateIndex = templates.length > 0 ? Math.floor(rng() * templates.length) : 0;
  const template = templates[templateIndex] ?? "";

  return {
    categoryId: "rivalry_statement",
    templateIndex,
    question: renderTemplate(template, payload),
  };
}
