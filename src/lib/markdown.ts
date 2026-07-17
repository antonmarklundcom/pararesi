import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Server-side markdown -> sanitized HTML. Content is admin-authored, but we
 * sanitize anyway as defense in depth before it reaches a member's browser. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title"],
      a: ["href", "name", "target", "rel"],
    },
  });
}
