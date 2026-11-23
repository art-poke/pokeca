export const previewAdminEmail = "admin@preview.invalid";

export function isPreviewDatabase(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/pokeca_admin_preview" &&
      !url.search
    );
  } catch {
    return false;
  }
}

export function adminPreviewEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LOCAL_ADMIN_PREVIEW === "1" &&
    isPreviewDatabase(process.env.DATABASE_URL)
  );
}

export function isAdminPreviewRequest(headers: Pick<Headers, "get">) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
  const forwarded = headers.get("x-forwarded-host");
  return (
    adminPreviewEnabled() &&
    local.test(headers.get("host") ?? "") &&
    (!forwarded || local.test(forwarded))
  );
}
