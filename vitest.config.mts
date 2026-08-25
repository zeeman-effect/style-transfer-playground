import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  envDir: "./tests",
  resolve: {
    alias: [
      {
        find: /^@\/lib\/db$/,
        replacement: fileURLToPath(new URL("./tests/mocks/db.ts", import.meta.url)),
      },
      {
        find: /^@\/lib\/auth$/,
        replacement: fileURLToPath(
          new URL("./tests/mocks/auth.ts", import.meta.url),
        ),
      },
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./src/", import.meta.url)),
      },
    ],
  },
  test: {
    root: fileURLToPath(new URL("./", import.meta.url)),
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
