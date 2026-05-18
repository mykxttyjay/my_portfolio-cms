import { AsyncLocalStorage } from 'node:async_hooks';

const ALS_KEY = /* @__PURE__ */ Symbol.for("emdash:request-context");
const storage = (
  // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- globalThis singleton pattern
  globalThis[ALS_KEY] ?? (() => {
    const als = new AsyncLocalStorage();
    globalThis[ALS_KEY] = als;
    return als;
  })()
);
function getRequestContext() {
  return storage.getStore();
}

export { getRequestContext as g };
