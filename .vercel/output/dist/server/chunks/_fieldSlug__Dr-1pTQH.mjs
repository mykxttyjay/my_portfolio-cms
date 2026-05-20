import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, u as unwrapResult } from './error_Da04EfM-.mjs';
import 'kysely';
import './revision_CCTbRhmI.mjs';
import './request-cache_BRmSfhRF.mjs';
import './user_C8998lto.mjs';
import { a as handleSchemaFieldDelete, b as handleSchemaFieldGet, c as handleSchemaFieldUpdate } from './schema_DXqnqgai.mjs';
import './request-context_Dj39IhTD.mjs';
import './index_DUdTeXmb.mjs';
import './manifest-schema_B5IPbR6v.mjs';
import '@emdash-cms/plugin-types';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { a6 as updateFieldBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const collectionSlug = params.slug;
  const fieldSlug = params.fieldSlug;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "schema:read");
  if (denied) return denied;
  const result = await handleSchemaFieldGet(emdash.db, collectionSlug, fieldSlug);
  return unwrapResult(result);
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const collectionSlug = params.slug;
  const fieldSlug = params.fieldSlug;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "schema:manage");
  if (denied) return denied;
  const body = await parseBody(request, updateFieldBody);
  if (isParseError(body)) return body;
  const result = await handleSchemaFieldUpdate(
    emdash.db,
    collectionSlug,
    fieldSlug,
    body
  );
  return unwrapResult(result);
};
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const collectionSlug = params.slug;
  const fieldSlug = params.fieldSlug;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "schema:manage");
  if (denied) return denied;
  const result = await handleSchemaFieldDelete(emdash.db, collectionSlug, fieldSlug);
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
