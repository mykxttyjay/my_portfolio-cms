import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleMenuDelete, handleMenuGet, handleMenuUpdate } from './menus_B22cB2zK.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { Z as updateMenuBody, V as localeFilterQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const denied = requirePerm(user, "menus:read");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const result = await handleMenuGet(emdash.db, name, { locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to fetch menu", "MENU_GET_ERROR");
  }
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const denied = requirePerm(user, "menus:manage");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const body = await parseBody(request, updateMenuBody);
    if (isParseError(body)) return body;
    const result = await handleMenuUpdate(emdash.db, name, { ...body, locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to update menu", "MENU_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const denied = requirePerm(user, "menus:manage");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const result = await handleMenuDelete(emdash.db, name, { locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to delete menu", "MENU_DELETE_ERROR");
  }
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
