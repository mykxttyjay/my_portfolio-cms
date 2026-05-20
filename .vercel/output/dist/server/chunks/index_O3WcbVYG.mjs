import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleMenuList, handleMenuCreate } from './menus_B22cB2zK.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { _ as createMenuBody, V as localeFilterQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "menus:read");
  if (denied) return denied;
  const query = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(query)) return query;
  try {
    const result = await handleMenuList(emdash.db, { locale: query.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to fetch menus", "MENU_LIST_ERROR");
  }
};
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "menus:manage");
  if (denied) return denied;
  try {
    const body = await parseBody(request, createMenuBody);
    if (isParseError(body)) return body;
    const result = await handleMenuCreate(emdash.db, body);
    return unwrapResult(result, 201);
  } catch (error) {
    return handleError(error, "Failed to create menu", "MENU_CREATE_ERROR");
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
