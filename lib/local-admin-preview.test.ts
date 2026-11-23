import { afterEach, expect, it, vi } from "vitest";
import { isAdminPreviewRequest } from "./local-admin-preview";

afterEach(() => vi.unstubAllEnvs());

it("enables anonymous admin access only for the opted-in loopback development fixture", () => {
  const db = "postgresql://127.0.0.1/pokeca_admin_preview";
  const headers = new Headers({ host: "localhost:3000" });
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("LOCAL_ADMIN_PREVIEW", "1");
  vi.stubEnv("DATABASE_URL", db);
  expect(isAdminPreviewRequest(headers)).toBe(true);
  expect(isAdminPreviewRequest(new Headers({ host: "artpokeca.com" }))).toBe(
    false,
  );
  expect(
    isAdminPreviewRequest(
      new Headers({ host: "localhost", "x-forwarded-host": "preview.example" }),
    ),
  ).toBe(false);
  vi.stubEnv("DATABASE_URL", "postgresql://127.0.0.1/pokeca");
  expect(isAdminPreviewRequest(headers)).toBe(false);
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://remote.example/pokeca_admin_preview",
  );
  expect(isAdminPreviewRequest(headers)).toBe(false);
  vi.stubEnv("DATABASE_URL", db);
  vi.stubEnv("NODE_ENV", "production");
  expect(isAdminPreviewRequest(headers)).toBe(false);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("LOCAL_ADMIN_PREVIEW", "");
  expect(isAdminPreviewRequest(headers)).toBe(false);
});
