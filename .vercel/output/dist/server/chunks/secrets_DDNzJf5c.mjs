import '@oslojs/crypto/sha2';
import '@oslojs/encoding';
import { O as OptionsRepository } from './options_DK6r2cuV.mjs';
import { a as encodeBase64url } from './base64_CEvRaSBc.mjs';

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": undefined, "SSR": true};
const IP_SALT_OPTION_KEY = "emdash:ip_salt";
const PREVIEW_SECRET_OPTION_KEY = "emdash:preview_secret";
const GENERATED_SECRET_BYTES = 32;
class EmDashSecretsError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "EmDashSecretsError";
    this.code = code;
  }
}
async function resolveSecrets(options) {
  const env = options.env ?? readDefaultEnv();
  const repo = options._repo ?? new OptionsRepository(options.db);
  const previewEnvOverride = pickFirstNonEmpty(env.EMDASH_PREVIEW_SECRET, env.PREVIEW_SECRET);
  const ipSaltEnvOverride = pickFirstNonEmpty(
    env.EMDASH_IP_SALT,
    env.EMDASH_AUTH_SECRET,
    env.AUTH_SECRET
  );
  const [previewSecret, ipSalt] = await Promise.all([
    previewEnvOverride !== null ? Promise.resolve({ value: previewEnvOverride, source: "env" }) : ensureGeneratedOption(repo, PREVIEW_SECRET_OPTION_KEY),
    ipSaltEnvOverride !== null ? Promise.resolve({ value: ipSaltEnvOverride, source: "env" }) : ensureGeneratedOption(repo, IP_SALT_OPTION_KEY)
  ]);
  return {
    previewSecret: previewSecret.value,
    previewSecretSource: previewSecret.source,
    ipSalt: ipSalt.value,
    ipSaltSource: ipSalt.source
  };
}
const SECRETS_CACHE_KEY = /* @__PURE__ */ Symbol.for("@emdash-cms/core/secrets-cache@1");
function getSecretsCache() {
  const holder = globalThis;
  let entry = holder[SECRETS_CACHE_KEY];
  if (!entry) {
    entry = { cache: /* @__PURE__ */ new WeakMap() };
    holder[SECRETS_CACHE_KEY] = entry;
  }
  return entry.cache;
}
function resolveSecretsCached(db) {
  const cache = getSecretsCache();
  const cached = cache.get(db);
  if (cached) return cached;
  const promise = resolveSecrets({ db }).catch((error) => {
    cache.delete(db);
    throw error;
  });
  cache.set(db, promise);
  return promise;
}
async function ensureGeneratedOption(repo, optionKey) {
  const existing = await repo.get(optionKey);
  if (typeof existing === "string" && existing.length > 0) {
    return { value: existing, source: "db" };
  }
  const generated = generateRandomSecret();
  const inserted = await repo.setIfAbsent(optionKey, generated);
  if (inserted) {
    return { value: generated, source: "db" };
  }
  const winner = await repo.get(optionKey);
  if (typeof winner !== "string" || winner.length === 0) {
    throw new EmDashSecretsError(
      `Failed to persist generated secret for "${optionKey}"`,
      "SECRET_PERSIST_FAILED"
    );
  }
  return { value: winner, source: "db" };
}
function generateRandomSecret() {
  const bytes = new Uint8Array(GENERATED_SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return encodeBase64url(bytes);
}
function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}
function readDefaultEnv() {
  const meta = Object.assign(__vite_import_meta_env__, {}) ?? {};
  const proc = typeof process !== "undefined" && process.env ? process.env : {};
  return {
    EMDASH_ENCRYPTION_KEY: meta.EMDASH_ENCRYPTION_KEY ?? proc.EMDASH_ENCRYPTION_KEY,
    EMDASH_PREVIEW_SECRET: meta.EMDASH_PREVIEW_SECRET ?? proc.EMDASH_PREVIEW_SECRET,
    PREVIEW_SECRET: meta.PREVIEW_SECRET ?? proc.PREVIEW_SECRET,
    EMDASH_IP_SALT: meta.EMDASH_IP_SALT ?? proc.EMDASH_IP_SALT,
    EMDASH_AUTH_SECRET: meta.EMDASH_AUTH_SECRET ?? proc.EMDASH_AUTH_SECRET,
    AUTH_SECRET: meta.AUTH_SECRET ?? proc.AUTH_SECRET
  };
}

export { resolveSecretsCached as r };
