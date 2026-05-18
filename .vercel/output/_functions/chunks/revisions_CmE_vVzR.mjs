import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult } from './error_Da04EfM-.mjs';

const prerender = false;
const GET = async ({ params, url, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "content:read_drafts");
  if (denied) return denied;
  const collection = params.collection;
  const id = params.id;
  if (!emdash?.handleRevisionList) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const limitParam = url.searchParams.get("limit");
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : void 0;
  const result = await emdash.handleRevisionList(collection, id, {
    limit: parsedLimit ? Math.max(1, Math.min(parsedLimit, 100)) : void 0
  });
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
