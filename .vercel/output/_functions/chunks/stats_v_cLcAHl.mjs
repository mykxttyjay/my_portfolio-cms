import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import 'kysely';
import { g as getSearchStats } from './query_noBLK03F.mjs';

const prerender = false;
const GET = async ({ locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "search:manage");
  if (denied) return denied;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
  }
  try {
    const stats = await getSearchStats(emdash.db);
    return apiSuccess(stats);
  } catch (error) {
    return handleError(error, "Failed to get stats", "STATS_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
