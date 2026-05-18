import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult } from './error_Da04EfM-.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const revisionId = params.revisionId;
  const denied = requirePerm(user, "content:read_drafts");
  if (denied) return denied;
  if (!emdash?.handleRevisionGet) {
    return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
  }
  const result = await emdash.handleRevisionGet(revisionId);
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
