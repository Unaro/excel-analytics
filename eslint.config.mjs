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
 * Осознанные исключения (cross-import одного слоя через public API):
 * widgets→widgets — композиция (dashboard-view встраивает kpi-grid и др.);
 * features→features — билдеры компонуют фичу metric-template.
 * Импорт мимо index.ts (entry-point) запрещён без исключений.
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
      "error",
      {
        default: "disallow",
        message: "FSD: слой «${file.type}» не может импортировать «${dependency.type}»",
        rules: [
          { from: "app", allow: ["widgets", "features", "entities", "shared"] },
          { from: "widgets", allow: ["widgets", "features", "entities", "shared"] },
          // features → features: осознанное исключение (FSD cross-import
          // через public API): билдеры компонуют фичу metric-template.
          { from: "features", allow: ["features", "entities", "shared"] },
          { from: "entities", allow: ["entities", "shared"] },
          { from: "shared", allow: ["shared"] },
        ],
      },
    ],
    "boundaries/entry-point": [
      "error",
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
 * set-state-in-effect оставлен в warn осознанно: оставшиеся вхождения —
 * канонические паттерны mount-флагов/гидрации (client-only, hydration,
 * use-engine-status) и синхронизация с async-источниками, где setState
 * в эффекте корректен. Новые вхождения видны в warnings и проверяются
 * на код-ревью. Остальной долг Phase 0 (use-memo, static-components,
 * no-empty-object-type) исправлен в Phase 4.
 */
const preexistingDebt = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "react-hooks/set-state-in-effect": "warn",
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
