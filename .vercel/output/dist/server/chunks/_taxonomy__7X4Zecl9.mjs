import { r as requirePerm, a as requireOwnerPerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, r as requireDb, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { B as contentTermsBody } from './redirects_jp1t_nEU.mjs';
import { TaxonomyRepository } from './taxonomy_CAMPWGuD.mjs';
import { invalidateTermCache } from './index_BanegER5.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const { collection, id, taxonomy } = params;
  const denied = requirePerm(user, "content:read");
  if (denied) return denied;
  if (!collection || !id || !taxonomy) {
    return apiError("VALIDATION_ERROR", "Collection, id, and taxonomy required", 400);
  }
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  try {
    const repo = new TaxonomyRepository(emdash.db);
    const terms = await repo.getTermsForEntry(collection, id, taxonomy);
    return apiSuccess({
      terms: terms.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        label: t.label,
        parentId: t.parentId
      }))
    });
  } catch (error) {
    return handleError(error, "Failed to get entry terms", "TERMS_GET_ERROR");
  }
};
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { collection, id, taxonomy } = params;
  if (!collection || !id || !taxonomy) {
    return apiError("VALIDATION_ERROR", "Collection, id, and taxonomy required", 400);
  }
  const denied = requirePerm(user, "content:edit_own");
  if (denied) return denied;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  if (!emdash.handleContentGet) {
    return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
  }
  const existing = await emdash.handleContentGet(collection, id);
  if (!existing.success) {
    return apiError(
      existing.error?.code ?? "NOT_FOUND",
      existing.error?.message ?? "Content not found",
      existing.error?.code === "NOT_FOUND" ? 404 : 500
    );
  }
  const existingData = existing.data && typeof existing.data === "object" ? (
    // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- handler returns unknown data; narrowed by typeof check above
    existing.data
  ) : void 0;
  const existingItem = existingData?.item && typeof existingData.item === "object" ? (
    // eslint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- narrowed by typeof check above
    existingData.item
  ) : existingData;
  const authorId = typeof existingItem?.authorId === "string" ? existingItem.authorId : "";
  const editDenied = requireOwnerPerm(user, authorId, "content:edit_own", "content:edit_any");
  if (editDenied) return editDenied;
  const canonicalId = typeof existingItem?.id === "string" ? existingItem.id : id;
  try {
    const body = await parseBody(request, contentTermsBody);
    if (isParseError(body)) return body;
    const { termIds } = body;
    const repo = new TaxonomyRepository(emdash.db);
    for (const termId of termIds) {
      const term = await repo.findById(termId);
      if (!term) {
        return apiError("NOT_FOUND", `Term ID '${termId}' not found`, 404);
      }
      if (term.name !== taxonomy) {
        return apiError(
          "VALIDATION_ERROR",
          `Term ID '${termId}' does not belong to taxonomy '${taxonomy}'`,
          400
        );
      }
    }
    await repo.setTermsForEntry(collection, canonicalId, taxonomy, termIds);
    invalidateTermCache();
    const terms = await repo.getTermsForEntry(collection, canonicalId, taxonomy);
    return apiSuccess({
      terms: terms.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        label: t.label,
        parentId: t.parentId
      }))
    });
  } catch (error) {
    return handleError(error, "Failed to set entry terms", "TERMS_SET_ERROR");
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
