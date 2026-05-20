import { ulid } from 'ulidx';
import { r as requirePerm } from './authorize_CL0Cm4YR.mjs';
import { a as apiError, b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';
import { p as parseBody, i as isParseError } from './parse_PnTzNOaQ.mjs';
import { as as createWidgetBody } from './redirects_jp1t_nEU.mjs';
import { r as rowToWidget } from './index_Ccn4_rte.mjs';

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
    const body = await parseBody(request, createWidgetBody);
    if (isParseError(body)) return body;
    const maxOrder = await db.selectFrom("_emdash_widgets").select(({ fn }) => fn.max("sort_order").as("maxOrder")).where("area_id", "=", area.id).executeTakeFirst();
    const sortOrder = (maxOrder?.maxOrder ?? -1) + 1;
    const id = ulid();
    await db.insertInto("_emdash_widgets").values({
      id,
      area_id: area.id,
      sort_order: sortOrder,
      type: body.type,
      title: body.title ?? null,
      content: body.content ? JSON.stringify(body.content) : null,
      menu_name: body.menuName ?? null,
      component_id: body.componentId ?? null,
      component_props: body.componentProps ? JSON.stringify(body.componentProps) : null
    }).execute();
    const widget = await db.selectFrom("_emdash_widgets").selectAll().$castTo().where("id", "=", id).executeTakeFirstOrThrow();
    return apiSuccess(rowToWidget(widget), 201);
  } catch (error) {
    return handleError(error, "Failed to create widget", "WIDGET_CREATE_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	POST,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
