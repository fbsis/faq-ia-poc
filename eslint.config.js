import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**", "**/.vite/**"]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-import-type-side-effects": "error"
    }
  },
  {
    files: [
      "apps/api/src/modules/**/domain/**/*.ts",
      "apps/api/src/modules/**/application/**/*.ts"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["fastify", "pg", "ioredis", "openai", "bullmq", "drizzle-orm*"],
              message: "Domain and application layers depend on ports, never infrastructure."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser
    },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules
  },
  {
    files: ["**/*.config.{js,ts}", "apps/api/**/*.ts"],
    languageOptions: { globals: globals.node }
  }
);
