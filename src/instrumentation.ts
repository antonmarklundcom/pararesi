import { assertProductionEnv, isProduction } from "@/config/env";

/**
 * Next runs this once when a server instance starts (not during `next build`).
 *
 * It is the boot gate for the production-required environment variables: a
 * deployment missing DATABASE_URL, APP_URL or SESSION_SECRET dies here, with
 * every problem listed at once, instead of serving pages that quietly point at
 * localhost or fail on the first query.
 */
export async function register(): Promise<void> {
  if (!isProduction()) return;
  assertProductionEnv();
}
