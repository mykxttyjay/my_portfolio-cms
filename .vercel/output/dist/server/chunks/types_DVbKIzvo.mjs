const FIELD_TYPES = [
  "string",
  "text",
  "url",
  "number",
  "integer",
  "boolean",
  "datetime",
  "select",
  "multiSelect",
  "portableText",
  "image",
  "file",
  "reference",
  "json",
  "slug",
  "repeater"
];
const FIELD_TYPE_TO_COLUMN = {
  string: "TEXT",
  text: "TEXT",
  number: "REAL",
  integer: "INTEGER",
  boolean: "INTEGER",
  datetime: "TEXT",
  select: "TEXT",
  multiSelect: "JSON",
  portableText: "JSON",
  image: "TEXT",
  file: "TEXT",
  reference: "TEXT",
  json: "JSON",
  slug: "TEXT",
  url: "TEXT",
  repeater: "JSON"
};
const RESERVED_FIELD_SLUGS = [
  "id",
  "slug",
  "status",
  "author_id",
  "primary_byline_id",
  "created_at",
  "updated_at",
  "published_at",
  "scheduled_at",
  "deleted_at",
  "version",
  "live_revision_id",
  "draft_revision_id",
  // Runtime-hydrated fields
  "terms",
  "bylines",
  "byline"
];
const RESERVED_COLLECTION_SLUGS = [
  "content",
  "media",
  "users",
  "revisions",
  "taxonomies",
  "options",
  "audit_logs"
];

export { FIELD_TYPES as F, RESERVED_COLLECTION_SLUGS as R, RESERVED_FIELD_SLUGS as a, FIELD_TYPE_TO_COLUMN as b };
