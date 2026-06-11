import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

/**
 * Схема слоёв FSD: app → widgets → features → entities → shared.
 *
 * Правила:
 *  - element-types: слой может импортировать только нижележащие слои
 *    (импорты внутри одного слайса не считаются нарушением);
 *  - entry-point: импорт чужого слайса только через его public API (index.ts).
 *
 * Severity `warn` — временно, на период рефакторинга (Phase 0–3):
 * в кодовой базе ~26 известных нарушений. После Phase 3d переключается
 * на `error` и становится блокирующим.
 */
const fsdBoundaries = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    "import/resolver": {
      typescript: { alwaysTryTypes: true },
    },
    "boundaries/elements": [
      { type: "app", pattern: "src/app", mode: "folder" },
      { type: "widgets", pattern: "src/widgets/*", mode: "folder", capture: ["slice"] },
      { type: "features", pattern: "src/features/*", mode: "folder", capture: ["slice"] },
      { type: "entities", pattern: "src/entities/*", mode: "folder", capture: ["slice"] },
      { type: "shared", pattern: "src/shared", mode: "folder" },
    ],
    "boundaries/include": ["src/**/*"],
  },
  rules: {
    "boundaries/element-types": [
      "warn",
      {
        default: "disallow",
        message: "FSD: слой «${file.type}» не может импортировать «${dependency.type}»",
        rules: [
          { from: "app", allow: ["widgets", "features", "entities", "shared"] },
          { from: "widgets", allow: ["features", "entities", "shared"] },
          { from: "features", allow: ["entities", "shared"] },
          { from: "entities", allow: ["entities", "shared"] },
          { from: "shared", allow: ["shared"] },
        ],
      },
    ],
    "boundaries/entry-point": [
      "warn",
      {
        default: "disallow",
        message:
          "FSD: импорт чужого слайса только через public API (index.ts), а не «${dependency.source}»",
        rules: [
          { target: ["shared", "app"], allow: "**" },
          { target: ["widgets", "features", "entities"], allow: ["index.ts", "index.tsx"] },
        ],
      },
    ],
  },
};

/**
 * Технический долг, вскрытый при включении линта (в Next 16 `next lint`
 * удалён, поэтому линт в проекте фактически не запускался).
 * 16 существующих ошибок переведены в warn до Phase 4 (React-фиксы),
 * после которой блок удаляется.
 */
const preexistingDebt = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/use-memo": "warn",
    "react-hooks/static-components": "warn",
    "@typescript-eslint/no-empty-object-type": "warn",
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  fsdBoundaries,
  preexistingDebt,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
