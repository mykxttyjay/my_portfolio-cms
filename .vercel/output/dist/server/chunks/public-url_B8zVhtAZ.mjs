let _envSiteUrl = null;
function getEnvSiteUrl() {
  if (_envSiteUrl !== null) return _envSiteUrl || void 0;
  try {
    const value = typeof process !== "undefined" && process.env?.EMDASH_SITE_URL || typeof process !== "undefined" && process.env?.SITE_URL || "";
    if (value) {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        _envSiteUrl = "";
        return void 0;
      }
      _envSiteUrl = parsed.origin;
    } else {
      _envSiteUrl = "";
    }
  } catch {
    _envSiteUrl = "";
  }
  return _envSiteUrl || void 0;
}
function getPublicOrigin(url, config) {
  return config?.siteUrl || getEnvSiteUrl() || url.origin;
}
let _envAllowedOrigins = null;
function getEnvAllowedOrigins() {
  if (_envAllowedOrigins !== null) return _envAllowedOrigins;
  const raw = typeof process !== "undefined" ? process.env?.EMDASH_ALLOWED_ORIGINS || "" : "";
  const parsed = [];
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    let u;
    try {
      u = new URL(trimmed);
    } catch (e) {
      throw new Error(`EmDash config error in EMDASH_ALLOWED_ORIGINS: invalid URL: "${trimmed}"`, {
        cause: e
      });
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error(
        `EmDash config error in EMDASH_ALLOWED_ORIGINS: origin must be http or https: "${trimmed}" (got ${u.protocol})`
      );
    }
    parsed.push(u.origin);
  }
  _envAllowedOrigins = parsed;
  return parsed;
}

export { getEnvAllowedOrigins as a, getPublicOrigin as g };
