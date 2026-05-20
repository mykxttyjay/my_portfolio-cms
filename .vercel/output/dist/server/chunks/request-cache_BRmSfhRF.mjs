import { g as getRequestContext } from './request-context_Dj39IhTD.mjs';

const STORE_KEY = /* @__PURE__ */ Symbol.for("emdash:request-cache");
const g = globalThis;
const store = (
  // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- globalThis singleton pattern (see request-context.ts)
  g[STORE_KEY] ?? (() => {
    const wm = /* @__PURE__ */ new WeakMap();
    g[STORE_KEY] = wm;
    return wm;
  })()
);
function requestCached(key, fn) {
  const ctx = getRequestContext();
  if (!ctx) return fn();
  let cache = store.get(ctx);
  if (!cache) {
    cache = /* @__PURE__ */ new Map();
    store.set(ctx, cache);
  }
  const existing = cache.get(key);
  if (existing) {
    if (ctx.metrics) ctx.metrics.cacheHits += 1;
    return existing;
  }
  if (ctx.metrics) ctx.metrics.cacheMisses += 1;
  const promise = Promise.resolve().then(fn).catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, promise);
  return promise;
}

export { requestCached as r };
