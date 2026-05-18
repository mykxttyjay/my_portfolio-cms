import { v as validateInvite, I as InviteError } from './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { r as roleFromLevel } from './types-ndj-bYfi_CoL8kXti.mjs';

const prerender = false;
const GET = async ({ url, locals }) => {
  const { emdash } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const token = url.searchParams.get("token");
  if (!token) {
    return apiError("MISSING_PARAM", "Token is required", 400);
  }
  try {
    const adapter = createKyselyAdapter(emdash.db);
    const invite = await validateInvite(adapter, token);
    return apiSuccess({
      success: true,
      email: invite.email,
      role: invite.role,
      roleName: roleFromLevel(invite.role)
    });
  } catch (error) {
    if (error instanceof InviteError) {
      const statusMap = {
        invalid_token: 404,
        token_expired: 410,
        user_exists: 409
      };
      return apiError(error.code.toUpperCase(), error.message, statusMap[error.code] ?? 400);
    }
    return handleError(error, "Failed to validate invite", "INVITE_VALIDATE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
