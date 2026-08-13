import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Next compiles JSX with the automatic runtime (no `React` import needed in
  // scope). Match that here so tests can import server components like
  // src/app/(marketing)/unsubscribe/page.tsx directly.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
