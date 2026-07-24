import { describe, expect, it, vi } from "vitest";
import { TEMPLATES, renderTemplate } from "./index";

// season_kickoff / pre_draft_statement / post_draft_statement are single
// fixed lines for the pre-season special events, not part of the
// 43-category Fragenkatalog — every other category ships with 15 templates.
const SINGLE_TEMPLATE_CATEGORIES = new Set([
  "season_kickoff",
  "pre_draft_statement",
  "post_draft_statement",
]);

describe("TEMPLATES", () => {
  it("loads all 46 category files with the expected template counts", () => {
    expect(Object.keys(TEMPLATES)).toHaveLength(46);
    for (const [id, templates] of Object.entries(TEMPLATES)) {
      const expected = SINGLE_TEMPLATE_CATEGORIES.has(id) ? 1 : 15;
      expect(templates.length, `${id} should have ${expected} template(s)`).toBe(expected);
    }
  });
});

describe("renderTemplate", () => {
  it("replaces every placeholder with its payload value", () => {
    const result = renderTemplate("{team} schlug {opponent} um {margin} Punkte.", {
      team: "Alpha",
      opponent: "Beta",
      margin: 3.5,
    });
    expect(result).toBe("Alpha schlug Beta um 3.5 Punkte.");
  });

  it("replaces a missing placeholder value with '?' and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = renderTemplate("{team} vs {opponent}", { team: "Alpha" });
    expect(result).toBe("Alpha vs ?");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
