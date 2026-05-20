import './index_Bxms_uoh.mjs';
import { z } from 'zod';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { a as handleApiTokenList, b as handleApiTokenCreate } from './api-tokens_DGGLu8fV.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { R as Role } from './types-ndj-bYfi_CoL8kXti.mjs';
import { V as VALID_SCOPES } from './authenticate-BiDGbUVY_CNGQ9xrZ.mjs';

const prerender = false;
const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(VALID_SCOPES)).min(1),
  expiresAt: z.string().datetime().optional()
});
const GET = async ({ locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  const result = await handleApiTokenList(emdash.db, user.id);
  return unwrapResult(result);
};
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  try {
    const body = await parseBody(request, createTokenSchema);
    if (isParseError(body)) return body;
    const result = await handleApiTokenCreate(emdash.db, user.id, body);
    return unwrapResult(result, 201);
  } catch (error) {
    return handleError(error, "Failed to create API token", "TOKEN_CREATE_ERROR");
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
