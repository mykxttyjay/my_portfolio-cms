import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleMenuItemReorder } from './menus_B22cB2zK.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { Y as reorderMenuItemsBody, V as localeFilterQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const denied = requirePerm(user, "menus:manage");
  if (denied) return denied;
  const localeQ = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(localeQ)) return localeQ;
  try {
    const body = await parseBody(request, reorderMenuItemsBody);
    if (isParseError(body)) return body;
    const result = await handleMenuItemReorder(emdash.db, name, body.items, {
      locale: localeQ.locale
    });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to reorder menu items", "MENU_REORDER_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
