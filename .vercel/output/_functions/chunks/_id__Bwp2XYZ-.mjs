import './index_Bxms_uoh.mjs';
import { a as apiError, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { h as handleApiTokenRevoke } from './api-tokens_DGGLu8fV.mjs';
import { R as Role } from './types-ndj-bYfi_CoL8kXti.mjs';

const prerender = false;
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  const tokenId = params.id;
  if (!tokenId) {
    return apiError("VALIDATION_ERROR", "Token ID is required", 400);
  }
  try {
    const result = await handleApiTokenRevoke(emdash.db, tokenId, user.id);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to revoke API token", "TOKEN_REVOKE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
