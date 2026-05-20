import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { r as requireDb, u as unwrapResult, h as handleError } from './error_Da04EfM-.mjs';
import { h as handleCommentBulk } from './comments_DmlPXjOm.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { f as commentBulkBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const POST = async ({ request, locals }) => {
  const { emdash, user } = locals;
  const dbErr = requireDb(emdash?.db);
  if (dbErr) return dbErr;
  try {
    const body = await parseBody(request, commentBulkBody);
    if (isParseError(body)) return body;
    if (body.action === "delete") {
      const denied = requirePerm(user, "comments:delete");
      if (denied) return denied;
    } else {
      const denied = requirePerm(user, "comments:moderate");
      if (denied) return denied;
    }
    const result = await handleCommentBulk(emdash.db, body.ids, body.action);
    return unwrapResult(result);
  } catch (error) {
    return handleError(error, "Failed to perform bulk operation", "COMMENT_BULK_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
