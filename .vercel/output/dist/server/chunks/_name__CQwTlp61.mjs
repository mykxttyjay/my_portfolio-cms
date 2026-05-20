import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { r as rowToWidget } from './index_Ccn4_rte.mjs';

const prerender = false;
const GET = async ({ params, locals }) => {
  const { emdash, user } = locals;
  const db = emdash.db;
  const { name } = params;
  const denied = requirePerm(user, "widgets:read");
  if (denied) return denied;
  if (!name) {
    return apiError("VALIDATION_ERROR", "name is required", 400);
  }
  try {
    const area = await db.selectFrom("_emdash_widget_areas").selectAll().where("name", "=", name).executeTakeFirst();
    if (!area) {
      return apiError("NOT_FOUND", `Widget area "${name}" not found`, 404);
    }
    const widgets = await db.selectFrom("_emdash_widgets").selectAll().$castTo().where("area_id", "=", area.id).orderBy("sort_order", "asc").execute();
    return apiSuccess({
      ...area,
      widgets: widgets.map((row) => rowToWidget(row))
    });
  } catch (error) {
    return handleError(error, "Failed to fetch widget area", "WIDGET_AREA_GET_ERROR");
  }
};
const DELETE = async ({ params, locals }) => {
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
    await db.deleteFrom("_emdash_widget_areas").where("id", "=", area.id).execute();
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleError(error, "Failed to delete widget area", "WIDGET_AREA_DELETE_ERROR");
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
