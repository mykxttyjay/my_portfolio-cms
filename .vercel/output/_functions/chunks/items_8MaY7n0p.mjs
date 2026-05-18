import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleMenuItemDelete, handleMenuItemCreate, handleMenuItemUpdate } from './menus_B22cB2zK.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { T as createMenuItemBody, U as updateMenuItemBody, V as localeFilterQuery, W as menuItemUpdateQuery, X as menuItemDeleteQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const denied = requirePerm(user, "menus:manage");
  if (denied) return denied;
  const localeQ = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(localeQ)) return localeQ;
  try {
    const body = await parseBody(request, createMenuItemBody);
    if (isParseError(body)) return body;
    const result = await handleMenuItemCreate(emdash.db, name, body, { locale: localeQ.locale });
    return unwrapResult(result, 201);
  } catch (error) {
    return handleError(error, "Failed to create menu item", "MENU_ITEM_CREATE_ERROR");
  }
};
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const denied = requirePerm(user, "menus:manage");
  if (denied) return denied;
  const url = new URL(request.url);
  const query = parseQuery(url, menuItemUpdateQuery);
  if (isParseError(query)) return query;
  const localeQ = parseQuery(url, localeFilterQuery);
  if (isParseError(localeQ)) return localeQ;
  const itemId = query.id;
  try {
    const body = await parseBody(request, updateMenuItemBody);
    if (isParseError(body)) return body;
    const result = await handleMenuItemUpdate(emdash.db, name, itemId, body, {
      locale: localeQ.locale
    });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to update menu item", "MENU_ITEM_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const denied = requirePerm(user, "menus:manage");
  if (denied) return denied;
  const url = new URL(request.url);
  const query = parseQuery(url, menuItemDeleteQuery);
  if (isParseError(query)) return query;
  const localeQ = parseQuery(url, localeFilterQuery);
  if (isParseError(localeQ)) return localeQ;
  const itemId = query.id;
  try {
    const result = await handleMenuItemDelete(emdash.db, name, itemId, { locale: localeQ.locale });
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to delete menu item", "MENU_ITEM_DELETE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	POST,
	PUT,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
