import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { ac as searchEnableBody } from './redirects_jp1t_nEU.mjs';
import { FTSManager } from './fts-manager_BjkO4e5p.mjs';
import 'kysely';
import './request-context_Dj39IhTD.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash not configured", 500);
  }
  const denied = requirePerm(user, "search:manage");
  if (denied) return denied;
  const body = await parseBody(request, searchEnableBody);
  if (isParseError(body)) return body;
  const ftsManager = new FTSManager(emdash.db);
  try {
    if (body.enabled) {
      await ftsManager.enableSearch(body.collection, { weights: body.weights });
      const stats = await ftsManager.getIndexStats(body.collection);
      return apiSuccess({
        collection: body.collection,
        enabled: true,
        indexed: stats?.indexed ?? 0
      });
    } else {
      await ftsManager.disableSearch(body.collection);
      return apiSuccess({
        collection: body.collection,
        enabled: false
      });
    }
  } catch (error) {
    return handleError(error, "Failed to update search config", "SEARCH_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
