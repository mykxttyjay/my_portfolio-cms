import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult } from './error_Da04EfM-.mjs';
import { a as parseQuery, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { x as contentTrashQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, url, locals }) => {
  const { emdash, user } = locals;
  const collection = params.collection;
  const denied = requirePerm(user, "content:read_drafts");
  if (denied) return denied;
  if (!emdash?.handleContentListTrashed) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const query = parseQuery(url, contentTrashQuery);
  if (isParseError(query)) return query;
  const result = await emdash.handleContentListTrashed(collection, query);
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
