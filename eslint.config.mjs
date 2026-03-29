import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude helper scripts (not application code)
    ".claude/**",
    ".swarm/**",
  ]),
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "max-lines": [
        "warn",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      "import/no-duplicates": "error",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "tests/**/*"],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
