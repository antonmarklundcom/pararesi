/**
 * Validates the `?next=` path the login form carries through, so it can only
 * ever send the browser somewhere on this site.
 *
 * Lives in its own module rather than inside the login action because a
 * "use server" file can't be imported by a test without dragging in the
 * database and next/navigation.
 *
 * The rule is stricter than it looks like it needs to be. Rejecting a leading
 * `//` is the obvious half; the half that was missing is the backslash.
 * Browsers normalise `\` to `/` while parsing a URL, so a Location header of
 * `/\evil.example` is fetched as `//evil.example` — a protocol-relative URL,
 * and a working open redirect dressed up as a relative path.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  // Exactly one leading slash, followed by something that is neither a slash
  // nor a backslash. Rejects "", "/", "//host", "/\host", "/\/host", "https://…".
  if (!/^\/[^/\\]/.test(next)) return null;
  // Control characters (a raw CR/LF, a tab) can be parsed differently by a
  // proxy than by the browser behind it; nothing legitimate needs them here.
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}
