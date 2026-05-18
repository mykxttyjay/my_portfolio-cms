import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, u as unwrapResult } from './error_Da04EfM-.mjs';
import 'kysely';
import './revision_CCTbRhmI.mjs';
import './request-cache_BRmSfhRF.mjs';
import './user_C8998lto.mjs';
import { f as handleSchemaCollectionDelete, g as handleSchemaCollectionGet, i as handleSchemaCollectionUpdate } from './schema_DXqnqgai.mjs';
import './request-context_Dj39IhTD.mjs';
import './index_DUdTeXmb.mjs';
import './manifest-schema_B5IPbR6v.mjs';
import '@emdash-cms/plugin-types';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { a8 as collectionGetQuery, a9 as updateCollectionBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, url, locals }) => {
  const { emdash, user } = locals;
  const slug = params.slug;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "schema:read");
  if (denied) return denied;
  const query = parseQuery(url, collectionGetQuery);
  if (isParseError(query)) return query;
  const result = await handleSchemaCollectionGet(emdash.db, slug, {
    includeFields: query.includeFields ?? false
  });
  return unwrapResult(result);
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const slug = params.slug;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "schema:manage");
  if (denied) return denied;
  const body = await parseBody(request, updateCollectionBody);
  if (isParseError(body)) return body;
  const result = await handleSchemaCollectionUpdate(
    emdash.db,
    slug,
    // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- parseBody validates via Zod
    body
  );
  emdash.invalidateUrlPatternCache();
  return unwrapResult(result);
};
const DELETE = async ({ params, url, locals }) => {
  const { emdash, user } = locals;
  const slug = params.slug;
  const force = url.searchParams.get("force") === "true";
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "schema:manage");
  if (denied) return denied;
  const result = await handleSchemaCollectionDelete(emdash.db, slug, {
    force
  });
  emdash.invalidateUrlPatternCache();
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	GET,
	PUT,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
