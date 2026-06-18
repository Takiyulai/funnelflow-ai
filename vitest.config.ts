import { defineConfig, configDefaults } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: false,
    include: ["tests/**/*.test.{ts,tsx}"],
    // L'ancien tests/components.test.ts contenait du JSX (non parsable en .ts).
    // Il est remplacé par tests/components.test.tsx. On exclut l'ancien fichier
    // au cas où il existerait encore (à supprimer manuellement).
    exclude: [...configDefaults.exclude, "tests/components.test.ts"],
    // L'export SIO (jsdom + fflate) peut être lent au démarrage à froid.
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "lib/funnels/**",
        "lib/export/**",
        "lib/ai/**",
        "components/funnel/**"
      ],
      exclude: ["**/*.d.ts", "**/node_modules/**"]
    }
  },
  // Runtime JSX automatique (comme Next.js) → pas besoin d'importer React
  // dans les fichiers de test .tsx.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // "server-only" n'est pas résolvable sous vitest/jsdom → module vide.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts")
    }
  }
});
