import './index_Bxms_uoh.mjs';
import { createKyselyAdapter } from './kysely_B71kB-eV.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { R as Role } from './types-ndj-bYfi_CoL8kXti.mjs';

const prerender = false;
const POST = async ({ params, locals }) => {
  const { emdash, user } = locals;
  if (!emdash?.db) {
    return apiError("NOT_CONFIGURED", "Database not configured", 500);
  }
  if (!user || user.role < Role.ADMIN) {
    return apiError("FORBIDDEN", "Admin privileges required", 403);
  }
  const adapter = createKyselyAdapter(emdash.db);
  const { id } = params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "User ID required", 400);
  }
  try {
    const targetUser = await adapter.getUserById(id);
    if (!targetUser) {
      return apiError("NOT_FOUND", "User not found", 404);
    }
    await adapter.updateUser(id, { disabled: false });
    return apiSuccess({ success: true });
  } catch (error) {
    return handleError(error, "Failed to enable user", "USER_ENABLE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
