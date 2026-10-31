import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const root = import.meta.dirname;
export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // server-only는 Next 번들러 밖에서 import 오류를 내므로 테스트에서는 빈 모듈로 바꾼다.
      "server-only": path.join(root, "tests/server-only-stub.ts")
    }
  },
  test: {
    projects: [{
      extends: true,
      test: {
        // .env.local의 로컬 Supabase 값을 쓴다. CI는 같은 이름의 환경 변수를 직접 넣는다.
        env: loadEnv("test", root, ""),
        include: ["lib/**/*.test.ts", "tests/integration/**/*.test.ts"],
        fileParallelism: false,
        // 통합 테스트가 공유 dev DB의 데모 데이터를 지우므로, 끝나면 자동으로 다시 깐다(로컬만).
        globalSetup: ["./tests/reseed-teardown.ts"]
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});