// @ts-check

import eslint from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig(
  [globalIgnores(["dist"])],
  eslint.configs.recommended,
  tseslint.configs.recommended,
  [
    {
      rules: {
        curly: ["error", "all"],
        "no-unassigned-vars": ["error"],
        eqeqeq: ["error"]
      }
    }
  ]
)
