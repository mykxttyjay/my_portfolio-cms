import { a as apiError } from './error_Da04EfM-.mjs';

const GLOBAL_KEY = /* @__PURE__ */ Symbol.for("emdash:dev-emails");
const g = globalThis;
(() => {
  const existing = g[GLOBAL_KEY];
  if (existing) return existing;
  const fresh = [];
  g[GLOBAL_KEY] = fresh;
  return fresh;
})();

const prerender = false;
const GET = async () => {
  {
    return apiError("FORBIDDEN", "Dev emails endpoint is only available in development mode", 403);
  }
};
const DELETE = async () => {
  {
    return apiError("FORBIDDEN", "Dev emails endpoint is only available in development mode", 403);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
