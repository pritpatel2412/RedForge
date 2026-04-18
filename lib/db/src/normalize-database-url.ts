/**
 * pg-connection-string v2 treats sslmode=require (and prefer / verify-ca) like verify-full
 * but emits a deprecation warning. Setting sslmode=verify-full explicitly matches that
 * behavior without the warning and prepares for pg v9 / pg-connection-string v3.
 */
export function normalizeDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const mode = u.searchParams.get("sslmode");
    if (
      mode === "require" ||
      mode === "prefer" ||
      mode === "verify-ca"
    ) {
      u.searchParams.set("sslmode", "verify-full");
      return u.toString();
    }
  } catch {
    /* keep original if not a valid URL */
  }
  return raw;
}
