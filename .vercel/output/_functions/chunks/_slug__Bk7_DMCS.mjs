import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, a as apiError, u as unwrapResult } from './error_Da04EfM-.mjs';
import 'kysely';
import './revision_CCTbRhmI.mjs';
import './request-cache_BRmSfhRF.mjs';
import './user_C8998lto.mjs';
import { l as handleOrphanedTableRegister } from './schema_DXqnqgai.mjs';
import './request-context_Dj39IhTD.mjs';
import './index_DUdTeXmb.mjs';
import './manifest-schema_B5IPbR6v.mjs';
import '@emdash-cms/plugin-types';
import { b as parseOptionalBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { ab as orphanRegisterBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "schema:manage");
  if (denied) return denied;
  const slug = params.slug;
  if (!slug) {
    return apiError("VALIDATION_ERROR", "Slug is required", 400);
  }
  const options = await parseOptionalBody(request, orphanRegisterBody, {});
  if (isParseError(options)) return options;
  const result = await handleOrphanedTableRegister(emdash.db, slug, options);
  return unwrapResult(result, 201);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
