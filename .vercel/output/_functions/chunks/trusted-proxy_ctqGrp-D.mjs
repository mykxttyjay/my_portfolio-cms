const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": undefined, "SSR": true};
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9a-z]+$/;
function normalizeTrustedHeaders(names) {
  return names.map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0 && HEADER_NAME_PATTERN.test(h));
}
function isValidHeaderName(name) {
  return HEADER_NAME_PATTERN.test(name);
}
let _envCache = null;
function getEnvTrustedHeaders() {
  if (_envCache !== null) return _envCache;
  let raw;
  try {
    const importMetaEnv = Object.assign(__vite_import_meta_env__, {});
    raw = (typeof process !== "undefined" ? process.env?.EMDASH_TRUSTED_PROXY_HEADERS : void 0) || importMetaEnv?.EMDASH_TRUSTED_PROXY_HEADERS;
  } catch {
    raw = void 0;
  }
  if (!raw) {
    _envCache = [];
    return _envCache;
  }
  _envCache = raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0 && isValidHeaderName(s));
  return _envCache;
}
function getTrustedProxyHeaders(config) {
  if (config && config.trustedProxyHeaders !== void 0) {
    return config.trustedProxyHeaders.map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0 && isValidHeaderName(h));
  }
  return getEnvTrustedHeaders();
}

export { getTrustedProxyHeaders as g, normalizeTrustedHeaders as n };
