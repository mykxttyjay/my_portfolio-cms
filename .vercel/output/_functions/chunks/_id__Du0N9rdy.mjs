import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { ar as updateWidgetBody } from './redirects_jp1t_nEU.mjs';
import { r as rowToWidget } from './index_Ccn4_rte.mjs';

const prerender = false;
const PUT = async ({ params, request, locals }) => {
  const { emdash, user } = locals;
  const db = emdash.db;
  const { name, id } = params;
  const denied = requirePerm(user, "widgets:manage");
  if (denied) return denied;
  if (!name || !id) {
    return apiError("VALIDATION_ERROR", "name and id are required", 400);
  }
  try {
    const area = await db.selectFrom("_emdash_widget_areas").select("id").where("name", "=", name).executeTakeFirst();
    if (!area) {
      return apiError("NOT_FOUND", `Widget area "${name}" not found`, 404);
    }
    const existingWidget = await db.selectFrom("_emdash_widgets").select("id").where("id", "=", id).where("area_id", "=", area.id).executeTakeFirst();
    if (!existingWidget) {
      return apiError("NOT_FOUND", `Widget "${id}" not found in area "${name}"`, 404);
    }
    const body = await parseBody(request, updateWidgetBody);
    if (isParseError(body)) return body;
    const updates = {};
    if (body.title !== void 0) updates.title = body.title || null;
    if (body.type !== void 0) updates.type = body.type;
    if (body.content !== void 0)
      updates.content = body.content ? JSON.stringify(body.content) : null;
    if (body.menuName !== void 0) updates.menu_name = body.menuName || null;
    if (body.componentId !== void 0) updates.component_id = body.componentId || null;
    if (body.componentProps !== void 0)
      updates.component_props = body.componentProps ? JSON.stringify(body.componentProps) : null;
    if (Object.keys(updates).length === 0) {
      return apiError("VALIDATION_ERROR", "No fields to update", 400);
    }
    await db.updateTable("_emdash_widgets").set(updates).where("id", "=", id).execute();
    const widget = await db.selectFrom("_emdash_widgets").selectAll().$castTo().where("id", "=", id).executeTakeFirstOrThrow();
    return apiSuccess(rowToWidget(widget));
  } catch (error) {
    return handleError(error, "Failed to update widget", "WIDGET_UPDATE_ERROR");
  }
};
const DELETE = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const db = emdash.db;
  const { name, id } = params;
  const denied = requirePerm(user, "widgets:manage");
  if (denied) return denied;
  if (!name || !id) {
    return apiError("VALIDATION_ERROR", "name and id are required", 400);
  }
  try {
    const area = await db.selectFrom("_emdash_widget_areas").select("id").where("name", "=", name).executeTakeFirst();
    if (!area) {
      return apiError("NOT_FOUND", `Widget area "${name}" not found`, 404);
    }
    const existingWidget = await db.selectFrom("_emdash_widgets").select("id").where("id", "=", id).where("area_id", "=", area.id).executeTakeFirst();
    if (!existingWidget) {
      return apiError("NOT_FOUND", `Widget "${id}" not found in area "${name}"`, 404);
    }
    await db.deleteFrom("_emdash_widgets").where("id", "=", id).execute();
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleError(error, "Failed to delete widget", "WIDGET_DELETE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	DELETE,
	PUT,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
