// V4 — single formatting mode chosen: Telegram HTML parse_mode.
// Any user-supplied text (category, note) MUST go through escapeHtml before
// being embedded in a reply, so brackets/asterisks/underscores in notes
// never break the markup.

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const PARSE_MODE = "HTML" as const;
