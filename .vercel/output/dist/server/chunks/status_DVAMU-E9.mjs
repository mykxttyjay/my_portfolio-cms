import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, r as requireDb, u as unwrapResult, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { b as handleCommentGet } from './comments_DmlPXjOm.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { g as commentStatusBody } from './redirects_jp1t_nEU.mjs';
import { g as getSiteBaseUrl } from './site-url_BNiFN_Aq.mjs';
import { m as moderateComment, l as lookupContentAuthor, s as sendCommentNotification } from './service_DBbSB0MQ.mjs';

const prerender = false;
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const { id } = params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "Comment ID required", 400);
  }
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  const denied = requirePerm(user, "comments:moderate");
  if (denied) return denied;
  try {
    const body = await parseBody(request, commentStatusBody);
    if (isParseError(body)) return body;
    const newStatus = body.status;
    const hookRunner = {
      async runBeforeCreate(event) {
        return emdash.hooks.runCommentBeforeCreate(event);
      },
      async runModerate(event) {
        const result = await emdash.hooks.invokeExclusiveHook("comment:moderate", event);
        if (!result) return { status: "pending", reason: "No moderator configured" };
        if (result.error) return { status: "pending", reason: "Moderation error" };
        return result.result;
      },
      fireAfterCreate(event) {
        emdash.hooks.runCommentAfterCreate(event).catch(
          (err) => console.error(
            "[comments] afterCreate error:",
            err instanceof Error ? err.message : err
          )
        );
      },
      fireAfterModerate(event) {
        emdash.hooks.runCommentAfterModerate(event).catch(
          (err) => console.error(
            "[comments] afterModerate error:",
            err instanceof Error ? err.message : err
          )
        );
      }
    };
    const existing = await handleCommentGet(emdash.db, id);
    if (!existing.success) {
      return unwrapResult(existing);
    }
    const previousStatus = existing.data.status;
    const updated = await moderateComment(
      emdash.db,
      id,
      newStatus,
      { id: user.id, name: user.name ?? null },
      hookRunner
    );
    if (!updated) {
      return apiError("NOT_FOUND", "Comment not found", 404);
    }
    if (newStatus === "approved" && previousStatus !== "approved" && emdash.email) {
      try {
        const adminBaseUrl = await getSiteBaseUrl(emdash.db, request);
        const content = await lookupContentAuthor(emdash.db, updated.collection, updated.contentId);
        if (content?.author) {
          await sendCommentNotification({
            email: emdash.email,
            comment: updated,
            contentAuthor: content.author,
            adminBaseUrl
          });
        }
      } catch (err) {
        console.error("[comments] notification error:", err instanceof Error ? err.message : err);
      }
    }
    return apiSuccess(updated);
  } catch (error) {
    return handleError(error, "Failed to update comment status", "COMMENT_STATUS_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	PUT,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
