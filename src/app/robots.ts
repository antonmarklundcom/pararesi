import type { MetadataRoute } from "next";
import { env } from "@/config/env";

const APP_URL = env.appUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/portal", "/portal/", "/admin", "/admin/", "/api"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
