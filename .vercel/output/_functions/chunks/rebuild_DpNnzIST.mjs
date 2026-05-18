import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { ad as searchRebuildBody } from './redirects_jp1t_nEU.mjs';
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
  const body = await parseBody(request, searchRebuildBody);
  if (isParseError(body)) return body;
  const ftsManager = new FTSManager(emdash.db);
  try {
    const config = await ftsManager.getSearchConfig(body.collection);
    if (!config?.enabled) {
      return apiError(
        "SEARCH_NOT_ENABLED",
        `Search is not enabled for collection "${body.collection}"`,
        400
      );
    }
    const searchableFields = await ftsManager.getSearchableFields(body.collection);
    if (searchableFields.length === 0) {
      return apiError(
        "NO_SEARCHABLE_FIELDS",
        `No searchable fields defined for collection "${body.collection}"`,
        400
      );
    }
    await ftsManager.rebuildIndex(body.collection, searchableFields, config.weights);
    const stats = await ftsManager.getIndexStats(body.collection);
    return apiSuccess({
      collection: body.collection,
      indexed: stats?.indexed ?? 0
    });
  } catch (error) {
    return handleError(error, "Failed to rebuild index", "REBUILD_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
