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
    }

    /**
     * Neon pooler endpoints can intermittently fail with channel_binding=require
     * in local Node/pg setups, surfacing as "Connection terminated unexpectedly".
     * Prefer opportunistic channel binding for better compatibility.
     */
    const host = u.hostname.toLowerCase();
    const channelBinding = u.searchParams.get("channel_binding");
    if (host.includes("-pooler.") && channelBinding === "require") {
      u.searchParams.set("channel_binding", "prefer");
    }

    return u.toString();
  } catch {
    /* keep original if not a valid URL */
  }
  return raw;
}
