interface TemplateFile {
  category_id: string;
  templates: string[];
}

const modules = import.meta.glob<{ default: TemplateFile }>("./*.json", {
  eager: true,
});

export const TEMPLATES: Record<string, string[]> = {};
for (const path in modules) {
  const file = modules[path].default;
  TEMPLATES[file.category_id] = file.templates;
}

const ALLOWED_PLACEHOLDERS = new Set([
  "team",
  "opponent",
  "player",
  "position",
  "points",
  "margin",
  "streak",
  "record",
  "week",
]);

const PLACEHOLDER_RE = /\{([a-zA-Z_]+)\}/g;

if (import.meta.env.DEV) {
  for (const path in modules) {
    const file = modules[path].default;
    file.templates.forEach((text, index) => {
      for (const match of text.matchAll(PLACEHOLDER_RE)) {
        const key = match[1];
        if (!ALLOWED_PLACEHOLDERS.has(key)) {
          console.error(
            `Media Room: unbekannter Platzhalter "{${key}}" in ${path} (Template #${index}).`
          );
        }
      }
    });
  }
}

/** Replaces every {key} occurrence in `text` with the matching payload value. */
export function renderTemplate(
  text: string,
  payload: Record<string, string | number>
): string {
  return text.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const value = payload[key];
    if (value === undefined) {
      console.warn(`Media Room: fehlender Platzhalterwert für "{${key}}".`);
      return "?";
    }
    return String(value);
  });
}
