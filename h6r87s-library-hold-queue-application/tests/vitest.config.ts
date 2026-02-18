import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Ensure React resolution for UI tests that import from frontend/src
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },
  test: {
    root: __dirname,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    globals: true,
    reporters: ["default"],
    // Default environment for backend/integration tests
    environment: "node",
    // Per-file environment overrides via inline @vitest-environment comments
    environmentMatchGlobs: [
      ["**/ui/**", "jsdom"],
    ],
    deps: {
      optimizer: {
        web: {
          include: ["@testing-library/jest-dom"],
        },
      },
    },
  },
});
