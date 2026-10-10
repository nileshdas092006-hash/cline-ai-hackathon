// Scheme-notice text helpers for the Rule Maintenance Agent. Pure.

export const MAX_NOTICE_CHARS = 20_000;

/** Trims, normalises line endings, collapses runs of blank lines and caps the length. */
export function normalizeNotice(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_NOTICE_CHARS);
}

/**
 * The notice text from one of the demo files in docs/ (markdown with `---` separators):
 * the source line (if the intro names one) plus the middle section. The title and the
 * "Expected agent behaviour" answer key are left out, so the agent works from the notice only.
 */
export function noticeFromDemoFile(markdown: string): string {
  const parts = markdown.replace(/\r\n?/g, "\n").split(/^\s*---\s*$/m);
  const intro = parts[0] ?? "";
  const body = parts.length > 1 ? parts[1] : intro;
  const source = /Source:\s*(https?:\/\/\S+?)[*_)\s]*$/m.exec(intro)?.[1];
  return normalizeNotice([source ? `Source: ${source}` : "", body].filter(Boolean).join("\n\n"));
}
