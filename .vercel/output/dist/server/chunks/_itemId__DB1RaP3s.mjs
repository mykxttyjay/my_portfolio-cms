import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "media:read");
  if (denied) return denied;
  const { providerId, itemId } = params;
  if (!providerId || !itemId) {
    return apiError("INVALID_REQUEST", "Provider ID and Item ID required", 400);
  }
  if (!emdash?.getMediaProvider) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const provider = emdash.getMediaProvider(providerId);
  if (!provider) {
    return apiError("NOT_FOUND", `Provider "${providerId}" not found`, 404);
  }
  if (!provider.get) {
    return apiError(
      "NOT_SUPPORTED",
      `Provider "${providerId}" does not support getting individual items`,
      400
    );
  }
  try {
    const item = await provider.get(itemId);
    if (!item) {
      return apiError("NOT_FOUND", "Item not found", 404);
    }
    return apiSuccess({ item });
  } catch (error) {
    return handleError(error, "Failed to get item from provider", "PROVIDER_GET_ERROR");
  }
};
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "media:delete_any");
  if (denied) return denied;
  const { providerId, itemId } = params;
  if (!providerId || !itemId) {
    return apiError("INVALID_REQUEST", "Provider ID and Item ID required", 400);
  }
  if (!emdash?.getMediaProvider) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const provider = emdash.getMediaProvider(providerId);
  if (!provider) {
    return apiError("NOT_FOUND", `Provider "${providerId}" not found`, 404);
  }
  if (!provider.delete) {
    return apiError("NOT_SUPPORTED", `Provider "${providerId}" does not support deletion`, 400);
  }
  try {
    await provider.delete(itemId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleError(error, "Failed to delete item from provider", "PROVIDER_DELETE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
