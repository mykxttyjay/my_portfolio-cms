import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { handleSettingsGet, handleSettingsUpdate } from './settings_Bb18vErB.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { aj as settingsUpdateBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const GET = async ({ locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const denied = requirePerm(user, "settings:read");
  if (denied) return denied;
  try {
    const result = await handleSettingsGet(emdash.db, emdash.storage);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to get settings", "SETTINGS_READ_ERROR");
  }
};
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const denied = requirePerm(user, "settings:manage");
  if (denied) return denied;
  try {
    const body = await parseBody(request, settingsUpdateBody);
    if (isParseError(body)) return body;
    const result = await handleSettingsUpdate(emdash.db, emdash.storage, body);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to update settings", "SETTINGS_UPDATE_ERROR");
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
