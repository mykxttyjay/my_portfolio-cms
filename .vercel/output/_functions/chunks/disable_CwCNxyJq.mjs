import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult } from './error_Da04EfM-.mjs';
import 'kysely';
import './revision_CCTbRhmI.mjs';
import './request-cache_BRmSfhRF.mjs';
import './user_C8998lto.mjs';
import './request-context_Dj39IhTD.mjs';
import { h as handlePluginDisable } from './plugins_DbODqOPU.mjs';
import './index_DUdTeXmb.mjs';
import './manifest-schema_B5IPbR6v.mjs';
import '@emdash-cms/plugin-types';
import './redirects_jp1t_nEU.mjs';
import { s as setCronTasksEnabled } from './cron_bjxv4NKK.mjs';

const prerender = false;
const POST = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const { id } = params;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const denied = requirePerm(user, "plugins:manage");
  if (denied) return denied;
  if (!id) {
    return apiError("INVALID_REQUEST", "Plugin ID required", 400);
  }
  const result = await handlePluginDisable(emdash.db, emdash.configuredPlugins, id);
  if (!result.success) return unwrapResult(result);
  await emdash.setPluginStatus(id, "inactive");
  await setCronTasksEnabled(emdash.db, id, false);
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
