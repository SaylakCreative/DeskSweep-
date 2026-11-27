const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Automated tests can point the updater at a feed on this computer (DESKSWEEP_UPDATE_URL).
 * Anything that is not an http(s) URL for localhost is ignored, so the setting can never
 * redirect real updates to another server.
 */
export function localFeedOverride(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const web = parsed.protocol === "http:" || parsed.protocol === "https:";
    return web && LOCAL_HOSTS.has(parsed.hostname) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}
