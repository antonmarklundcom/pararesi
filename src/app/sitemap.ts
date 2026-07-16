import type { MetadataRoute } from "next";

const STATIC_ROUTES = [
  "",
  "/guide",
  "/pricing",
  "/blog",
  "/about",
  "/terms",
  "/privacy",
  "/refund-policy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // Published blog slugs are added once src/db is wired up in Phase 1+.
  return STATIC_ROUTES.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified: new Date(),
  }));
}
