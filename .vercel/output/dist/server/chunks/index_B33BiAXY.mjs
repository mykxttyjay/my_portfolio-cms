import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { c as handleSectionList, d as handleSectionCreate } from './sections_B1nkfU_k.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { ah as sectionsListQuery, ai as createSectionBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ url, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const denied = requirePerm(user, "sections:read");
  if (denied) return denied;
  try {
    const query = parseQuery(url, sectionsListQuery);
    if (isParseError(query)) return query;
    const result = await handleSectionList(db, query);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to fetch sections", "SECTION_LIST_ERROR");
  }
};
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const db = emdash.db;
  const denied = requirePerm(user, "sections:manage");
  if (denied) return denied;
  try {
    const body = await parseBody(request, createSectionBody);
    if (isParseError(body)) return body;
    const result = await handleSectionCreate(db, body);
    return unwrapResult(result, 201);
  } catch (error) {
    return handleError(error, "Failed to create section", "SECTION_CREATE_ERROR");
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
