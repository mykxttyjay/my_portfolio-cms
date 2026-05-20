import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError } from './error_Da04EfM-.mjs';

const prerender = false;
const GET = async ({ params, url, locals }) => {
  const { emdash, user } = locals;
  const { id } = params;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const denied = requirePerm(user, "plugins:read");
  if (denied) return denied;
  const marketplaceUrl = emdash.config.marketplace;
  if (!marketplaceUrl || !id) {
    return apiError("NOT_CONFIGURED", "Marketplace not configured", 400);
  }
  const width = url.searchParams.get("w");
  const target = new URL(`/api/v1/plugins/${encodeURIComponent(id)}/icon`, marketplaceUrl);
  if (width) target.searchParams.set("w", width);
  try {
    const resp = await fetch(target.href);
    if (!resp.ok) {
      return new Response(resp.body, {
        status: resp.status,
        headers: {
          "Content-Type": resp.headers.get("Content-Type") ?? "application/octet-stream",
          "Cache-Control": "private, no-store"
        }
      });
    }
    return new Response(resp.body, {
      headers: {
        "Content-Type": resp.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return apiError("PROXY_ERROR", "Failed to fetch icon", 502);
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
