import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { aq as reorderWidgetsBody } from './redirects_jp1t_nEU.mjs';

const prerender = false;
const POST = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const db = emdash.db;
  const { name } = params;
  const denied = requirePerm(user, "widgets:manage");
  if (denied) return denied;
  if (!name) {
    return apiError("VALIDATION_ERROR", "name is required", 400);
  }
  try {
    const area = await db.selectFrom("_emdash_widget_areas").select("id").where("name", "=", name).executeTakeFirst();
    if (!area) {
      return apiError("NOT_FOUND", `Widget area "${name}" not found`, 404);
    }
    const body = await parseBody(request, reorderWidgetsBody);
    if (isParseError(body)) return body;
    const existingWidgets = await db.selectFrom("_emdash_widgets").select("id").where("area_id", "=", area.id).execute();
    const existingIds = new Set(existingWidgets.map((w) => w.id));
    for (const id of body.widgetIds) {
      if (!existingIds.has(id)) {
        return apiError("VALIDATION_ERROR", `Widget "${id}" not found in area "${name}"`, 400);
      }
    }
    await Promise.all(
      body.widgetIds.map(
        (id, index) => db.updateTable("_emdash_widgets").set({ sort_order: index }).where("id", "=", id).execute()
      )
    );
    return apiSuccess({ success: true });
  } catch (error) {
    return handleError(error, "Failed to reorder widgets", "WIDGET_REORDER_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
