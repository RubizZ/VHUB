import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier"; // 1. Importamos la config de Prettier

export default [
  js.configs.recommended,
  {
    // Aplica a tus archivos de desarrollo y origen
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Cargamos las reglas planas directamente de los objetos de los plugins
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...tsPlugin.configs.recommended.rules,
      
      // Tus reglas personalizadas
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "error",

      // 2. Aplicamos las reglas de desactivación de Prettier al final del objeto
      ...eslintConfigPrettier.rules,
    },
  },
];