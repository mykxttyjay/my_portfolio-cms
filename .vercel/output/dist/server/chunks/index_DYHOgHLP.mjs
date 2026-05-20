import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleTaxonomyList, handleTaxonomyCreate } from './taxonomies_nAuOqHDY.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { ap as createTaxonomyDefBody, V as localeFilterQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "taxonomies:read");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const result = await handleTaxonomyList(emdash.db, { locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to list taxonomies", "TAXONOMY_LIST_ERROR");
  }
};
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "taxonomies:manage");
  if (denied) return denied;
  try {
    const body = await parseBody(request, createTaxonomyDefBody);
    if (isParseError(body)) return body;
    const result = await handleTaxonomyCreate(emdash.db, body);
    return unwrapResult(result, 201);
  } catch (error) {
    return handleError(error, "Failed to create taxonomy", "TAXONOMY_CREATE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
