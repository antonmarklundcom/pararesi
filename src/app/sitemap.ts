import type { MetadataRoute } from "next";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const staticRoutes = ["", "/guide", "/pricing", "/blog", "/about", "/terms", "/privacy", "/refund-policy"];

// Published blogPosts slugs are appended here once Phase 1 (schema) and
// Phase 6 (marketing pages) exist.
export default function sitemap(): MetadataRoute.Sitemap {
  return staticRoutes.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: new Date(),
  }));
}
