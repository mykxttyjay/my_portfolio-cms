import 'kysely';
import './request-context_Dj39IhTD.mjs';

function rowToWidget(row) {
  const widget = {
    id: row.id,
    type: row.type,
    title: row.title ?? void 0
  };
  if (row.type === "content" && row.content) {
    try {
      widget.content = JSON.parse(row.content);
    } catch {
    }
  }
  if (row.type === "menu" && row.menu_name) {
    widget.menuName = row.menu_name;
  }
  if (row.type === "component" && row.component_id) {
    widget.componentId = row.component_id;
    if (row.component_props) {
      try {
        widget.componentProps = JSON.parse(row.component_props);
      } catch {
      }
    }
  }
  return widget;
}

export { rowToWidget as r };
