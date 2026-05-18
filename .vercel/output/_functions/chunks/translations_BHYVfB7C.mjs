import { z } from 'zod';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleMenuGet, handleMenuTranslations, handleMenuCreate } from './menus_B22cB2zK.mjs';
import { a as parseQuery, i as isParseError, p as parseBody } from './parse_PnTzNOaQ.mjs';
import { V as localeFilterQuery } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const createTranslationBody = z.object({
  locale: z.string().min(1),
  label: z.string().min(1).optional()
}).meta({ id: "CreateMenuTranslationBody" });
const GET = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "menus:read");
  if (denied) return denied;
  const localeQ = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(localeQ)) return localeQ;
  try {
    const anchor = await handleMenuGet(emdash.db, name, { locale: localeQ.locale });
    if (!anchor.success) return unwrapResult(anchor);
    const result = await handleMenuTranslations(emdash.db, anchor.data.id);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to fetch menu translations", "MENU_TRANSLATIONS_ERROR");
  }
};
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const name = params.name;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "menus:manage");
  if (denied) return denied;
  const localeQ = parseQuery(new URL(request.url), localeFilterQuery);
  if (isParseError(localeQ)) return localeQ;
  try {
    const body = await parseBody(request, createTranslationBody);
    if (isParseError(body)) return body;
    const source = await handleMenuGet(emdash.db, name, { locale: localeQ.locale });
    if (!source.success) return unwrapResult(source);
    const result = await handleMenuCreate(emdash.db, {
      name,
      label: body.label ?? source.data.label,
      locale: body.locale,
      translationOf: source.data.id
    });
    return unwrapResult(result, 201);
  } catch (error) {
    return handleError(error, "Failed to create menu translation", "MENU_TRANSLATION_CREATE_ERROR");
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
