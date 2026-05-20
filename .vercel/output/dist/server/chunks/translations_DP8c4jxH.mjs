import { h as hasPermission } from './index_Bxms_uoh.mjs';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, u as unwrapResult } from './error_Da04EfM-.mjs';

const prerender = false;
function isPublished(t) {
  return typeof t === "object" && t !== null && "status" in t && t.status === "published";
}
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const denied = requirePerm(user, "content:read");
  if (denied) return denied;
  const collection = params.collection;
  const id = params.id;
  if (!emdash?.handleContentTranslations) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const result = await emdash.handleContentTranslations(collection, id);
  if (result.success && !hasPermission(user, "content:read_drafts")) {
    const data = result.data && typeof result.data === "object" ? (
      // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- handler returns unknown data; narrowed by typeof check
      result.data
    ) : void 0;
    const translations = Array.isArray(data?.translations) ? data.translations : [];
    const filtered = translations.filter(isPublished);
    return unwrapResult({
      success: true,
      data: { ...data, translations: filtered }
    });
  }
  return unwrapResult(result);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
