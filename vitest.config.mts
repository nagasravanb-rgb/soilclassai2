import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts", "tests/components/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
});
