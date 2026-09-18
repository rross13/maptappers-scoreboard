import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src,
      // `server-only` exists to fail a build if a module is pulled into a client
      // bundle. Under Vitest there is no bundler, so it is stubbed out.
      "server-only": fileURLToPath(new URL("./test/noop.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./test/setup-db.ts"],
    coverage: { provider: "v8", include: ["src/lib/**"] },
  },
});
