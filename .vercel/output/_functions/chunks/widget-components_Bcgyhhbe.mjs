import { b as apiSuccess, h as handleError } from './error_Da04EfM-.mjs';

const coreWidgetComponents = [
  {
    id: "core:recent-posts",
    label: "Recent Posts",
    description: "Display a list of recent posts",
    props: {
      count: {
        type: "number",
        label: "Number of posts",
        default: 5
      },
      showThumbnails: {
        type: "boolean",
        label: "Show thumbnails",
        default: false
      },
      showDate: {
        type: "boolean",
        label: "Show date",
        default: true
      }
    }
  },
  {
    id: "core:categories",
    label: "Categories",
    description: "Display category list",
    props: {
      showCount: {
        type: "boolean",
        label: "Show post count",
        default: true
      },
      hierarchical: {
        type: "boolean",
        label: "Show hierarchy",
        default: true
      }
    }
  },
  {
    id: "core:tags",
    label: "Tags",
    description: "Display tag cloud",
    props: {
      showCount: {
        type: "boolean",
        label: "Show count",
        default: false
      },
      limit: {
        type: "number",
        label: "Maximum tags",
        default: 20
      }
    }
  },
  {
    id: "core:search",
    label: "Search",
    description: "Search form",
    props: {
      placeholder: {
        type: "string",
        label: "Placeholder text",
        default: "Search..."
      }
    }
  },
  {
    id: "core:archives",
    label: "Archives",
    description: "Monthly/yearly archives",
    props: {
      type: {
        type: "select",
        label: "Group by",
        default: "monthly",
        options: [
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" }
        ]
      },
      limit: {
        type: "number",
        label: "Limit",
        default: 12
      }
    }
  }
];
function getWidgetComponents() {
  return [...coreWidgetComponents];
}

const prerender = false;
const GET = async () => {
  try {
    const components = getWidgetComponents();
    return apiSuccess({ items: components });
  } catch (error) {
    return handleError(error, "Failed to fetch widget components", "WIDGET_COMPONENTS_ERROR");
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	GET,
	prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
