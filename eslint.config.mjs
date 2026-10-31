// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
  ]),
  ...storybook.configs["flat/recommended"],

  // ── 레이어 경계 (AI 바이브코딩 가드레일) ──────────────────────────────────
  // 토스트는 gr-toast로만. sonner 직접 import 금지.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/toast/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "sonner",
              importNames: ["toast"],
              message:
                "lib/toast/gr-toast의 showErrorToast/showSuccessToast/showInfoToast를 사용하세요. (<Toaster> 마운트는 허용)",
            },
          ],
        },
      ],
    },
  },
  // 컴포넌트는 hooks를 통해서만 데이터 접근. api/actions·queries 직접 import 금지.
  // (서버 prefetch는 도메인 루트의 *-page.tsx에서만 한다)
  {
    files: ["**/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "sonner", importNames: ["toast"], message: "gr-toast를 사용하세요." },
          ],
          patterns: [
            {
              group: ["**/api/actions", "**/api/queries"],
              message:
                "컴포넌트는 도메인 hooks(useXxxQuery/useXxxMutation)를 통해서만 데이터에 접근하세요.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
