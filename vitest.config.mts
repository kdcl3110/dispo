// Tests automatiques des règles métier (npm test). Les tests vivent à côté
// du fichier qu'ils vérifient : src/lib/slots.ts → src/lib/slots.test.ts.

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Hors de Next, « server-only » refuse d'être importé : on le neutralise.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Dates calculées en UTC : on vérifie qu'aucun fuseau ne les décale.
    env: { TZ: "Europe/Brussels" },
  },
});
