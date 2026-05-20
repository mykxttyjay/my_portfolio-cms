import { z } from 'zod';

const VALID_ROLE_LEVELS = /* @__PURE__ */ new Set([10, 20, 30, 40, 50]);
const roleLevel = z.coerce.number().int().refine((n) => VALID_ROLE_LEVELS.has(n), {
  message: "Invalid role level. Must be 10, 20, 30, 40, or 50"
});
const cursorPaginationQuery = z.object({
  cursor: z.string().max(2048).optional().meta({ description: "Opaque cursor for pagination" }),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50).meta({
    description: "Maximum number of items to return (1-100, default 50)"
  })
}).meta({ id: "CursorPaginationQuery" });
z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0)
}).meta({ id: "OffsetPaginationQuery" });
const slugPattern = /^[a-z][a-z0-9_]*$/;
const HTTP_SCHEME_RE = /^https?:\/\//i;
const httpUrl = z.string().url().refine((url) => HTTP_SCHEME_RE.test(url), "URL must use http or https");
const localeCode = z.string().regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i, "Invalid locale code").transform((v) => v.toLowerCase());
const localeFilterQuery = z.object({
  locale: z.string().min(1).optional()
}).meta({ id: "LocaleFilterQuery" });
z.object({
  error: z.object({
    code: z.string().meta({ description: "Machine-readable error code", example: "NOT_FOUND" }),
    message: z.string().meta({ description: "Human-readable error message" })
  })
}).meta({ id: "ApiError" });
z.object({ deleted: z.literal(true) }).meta({
  id: "DeleteResponse"
});
z.object({ count: z.number().int().min(0) }).meta({ id: "CountResponse" });

const bylineSlugPattern = /^[a-z][a-z0-9-]*$/;
const bylineSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarMediaId: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  userId: z.string().nullable(),
  isGuest: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
}).meta({ id: "BylineSummary" });
const bylineCreditSchema = z.object({
  byline: bylineSummarySchema,
  sortOrder: z.number().int(),
  roleLabel: z.string().nullable(),
  source: z.enum(["explicit", "inferred"]).optional().meta({
    description: "Whether this credit was explicitly assigned or inferred from authorId"
  })
}).meta({ id: "BylineCredit" });
const contentBylineInputSchema = z.object({
  bylineId: z.string().min(1),
  roleLabel: z.string().nullish()
}).meta({ id: "ContentBylineInput" });
const bylinesListQuery = cursorPaginationQuery.extend({
  search: z.string().optional(),
  isGuest: z.coerce.boolean().optional(),
  userId: z.string().optional()
}).meta({ id: "BylinesListQuery" });
const bylineCreateBody = z.object({
  slug: z.string().min(1).regex(bylineSlugPattern, "Slug must contain only lowercase letters, digits, and hyphens"),
  displayName: z.string().min(1),
  bio: z.string().nullish(),
  avatarMediaId: z.string().nullish(),
  websiteUrl: httpUrl.nullish(),
  userId: z.string().nullish(),
  isGuest: z.boolean().optional()
}).meta({ id: "BylineCreateBody" });
const bylineUpdateBody = z.object({
  slug: z.string().min(1).regex(bylineSlugPattern, "Slug must contain only lowercase letters, digits, and hyphens").optional(),
  displayName: z.string().min(1).optional(),
  bio: z.string().nullish(),
  avatarMediaId: z.string().nullish(),
  websiteUrl: httpUrl.nullish(),
  userId: z.string().nullish(),
  isGuest: z.boolean().optional()
}).meta({ id: "BylineUpdateBody" });
z.object({
  items: z.array(bylineSummarySchema),
  nextCursor: z.string().optional()
}).meta({ id: "BylineListResponse" });

const contentSeoInput = z.object({
  title: z.string().max(200).nullish(),
  description: z.string().max(500).nullish(),
  image: z.string().nullish(),
  canonical: httpUrl.nullish(),
  noIndex: z.boolean().optional()
}).meta({ id: "ContentSeoInput" });
const contentListQuery = cursorPaginationQuery.extend({
  status: z.string().optional(),
  orderBy: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  locale: localeCode.optional()
}).meta({ id: "ContentListQuery" });
const contentDateOverride = z.iso.datetime({ offset: true, message: "must be an ISO 8601 datetime" }).nullish();
const contentCreateBody = z.object({
  data: z.record(z.string(), z.unknown()),
  slug: z.string().nullish(),
  status: z.enum(["draft"]).optional(),
  bylines: z.array(contentBylineInputSchema).optional(),
  locale: localeCode.optional(),
  translationOf: z.string().optional(),
  seo: contentSeoInput.optional(),
  publishedAt: contentDateOverride,
  createdAt: contentDateOverride
}).meta({ id: "ContentCreateBody" });
const contentUpdateBody = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  slug: z.string().nullish(),
  status: z.enum(["draft"]).optional(),
  authorId: z.string().nullish(),
  bylines: z.array(contentBylineInputSchema).optional(),
  _rev: z.string().optional().meta({ description: "Opaque revision token for optimistic concurrency" }),
  skipRevision: z.boolean().optional(),
  seo: contentSeoInput.optional(),
  publishedAt: contentDateOverride
}).meta({ id: "ContentUpdateBody" });
const contentScheduleBody = z.object({
  scheduledAt: z.string().min(1, "scheduledAt is required").meta({
    description: "ISO 8601 datetime for scheduled publishing",
    example: "2025-06-15T09:00:00Z"
  })
}).meta({ id: "ContentScheduleBody" });
const contentPublishBody = z.object({
  // .optional() rather than .nullish(): publishing has no semantic
  // meaning for `null` (you can't "clear" a publish timestamp by
  // publishing). Tightening the schema here means callers either
  // pass a valid datetime or omit the field, and the route doesn't
  // have to silently drop a null that snuck through.
  publishedAt: z.iso.datetime({ offset: true, message: "must be an ISO 8601 datetime" }).optional().meta({
    description: "Optional ISO 8601 datetime to backdate the publish (e.g. when migrating content). Requires content:publish_any permission. Without this, existing published_at is preserved on re-publish."
  })
}).meta({ id: "ContentPublishBody" });
const contentPreviewUrlBody = z.object({
  expiresIn: z.union([z.string(), z.number()]).optional(),
  pathPattern: z.string().optional()
}).meta({ id: "ContentPreviewUrlBody" });
const contentTermsBody = z.object({
  termIds: z.array(z.string())
}).meta({ id: "ContentTermsBody" });
const contentTrashQuery = cursorPaginationQuery;
const contentSeoSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  canonical: z.string().nullable(),
  noIndex: z.boolean()
}).meta({ id: "ContentSeo" });
const contentItemSchema = z.object({
  id: z.string(),
  type: z.string().meta({ description: "Collection slug this item belongs to" }),
  slug: z.string().nullable(),
  status: z.string().meta({ description: "draft, published, or scheduled" }),
  data: z.record(z.string(), z.unknown()).meta({
    description: "User-defined field values"
  }),
  authorId: z.string().nullable(),
  primaryBylineId: z.string().nullable(),
  byline: bylineSummarySchema.nullable().optional(),
  bylines: z.array(bylineCreditSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  liveRevisionId: z.string().nullable(),
  draftRevisionId: z.string().nullable(),
  version: z.number().int(),
  locale: z.string().nullable(),
  translationGroup: z.string().nullable(),
  seo: contentSeoSchema.optional()
}).meta({ id: "ContentItem" });
z.object({
  item: contentItemSchema,
  _rev: z.string().optional().meta({ description: "Opaque revision token for optimistic concurrency" })
}).meta({ id: "ContentResponse" });
z.object({
  items: z.array(contentItemSchema),
  nextCursor: z.string().optional()
}).meta({ id: "ContentListResponse" });
const trashedContentItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  slug: z.string().nullable(),
  status: z.string(),
  data: z.record(z.string(), z.unknown()),
  authorId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  deletedAt: z.string()
}).meta({ id: "TrashedContentItem" });
z.object({
  items: z.array(trashedContentItemSchema),
  nextCursor: z.string().optional()
}).meta({ id: "TrashedContentListResponse" });
z.object({
  hasChanges: z.boolean(),
  live: z.record(z.string(), z.unknown()).nullable(),
  draft: z.record(z.string(), z.unknown()).nullable()
}).meta({ id: "ContentCompareResponse" });
const contentTranslationSchema = z.object({
  id: z.string(),
  locale: z.string().nullable(),
  slug: z.string().nullable(),
  status: z.string(),
  updatedAt: z.string()
});
z.object({
  translationGroup: z.string(),
  translations: z.array(contentTranslationSchema)
}).meta({ id: "ContentTranslationsResponse" });

const mimeTypeFilter = z.union([z.string(), z.array(z.string())]).transform((v) => {
  const arr = Array.isArray(v) ? v : v.split(",");
  return arr.map((s) => s.trim()).filter((s) => s.length > 0);
}).optional();
const mediaListQuery = cursorPaginationQuery.extend({
  mimeType: mimeTypeFilter
}).meta({ id: "MediaListQuery" });
const mediaUpdateBody = z.object({
  alt: z.string().optional(),
  caption: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
}).meta({ id: "MediaUpdateBody" });
const DEFAULT_MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)}KB`;
  return `${Math.floor(bytes / 1024 / 1024)}MB`;
}
const CONTENT_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_+\-.]*\/[a-z0-9!#$&^_+\-.]+(\s*;[^\r\n]*)?$/i;
function mediaUploadUrlBody(maxSize) {
  if (!Number.isFinite(maxSize) || maxSize <= 0) {
    throw new Error(`EmDash: maxUploadSize must be a positive finite number, got ${maxSize}`);
  }
  return z.object({
    filename: z.string().min(1, "filename is required"),
    contentType: z.string().min(1, "contentType is required").regex(CONTENT_TYPE_RE, "Invalid content type"),
    size: z.number().int().positive().max(maxSize, `File size must not exceed ${formatFileSize(maxSize)}`),
    contentHash: z.string().optional(),
    fieldId: z.string().optional()
  }).meta({ id: "MediaUploadUrlBody" });
}
const mediaConfirmBody = z.object({
  size: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
}).meta({ id: "MediaConfirmBody" });
cursorPaginationQuery.extend({
  query: z.string().optional(),
  mimeType: mimeTypeFilter
}).meta({ id: "MediaProviderListQuery" });
const mediaStatusSchema = z.enum(["pending", "ready", "failed"]);
const mediaItemSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  alt: z.string().nullable(),
  caption: z.string().nullable(),
  storageKey: z.string(),
  status: mediaStatusSchema,
  contentHash: z.string().nullable(),
  blurhash: z.string().nullable(),
  dominantColor: z.string().nullable(),
  createdAt: z.string(),
  authorId: z.string().nullable()
}).meta({ id: "MediaItem" });
z.object({ item: mediaItemSchema }).meta({ id: "MediaResponse" });
z.object({
  items: z.array(mediaItemSchema),
  nextCursor: z.string().optional()
}).meta({ id: "MediaListResponse" });
z.object({
  uploadUrl: z.string(),
  method: z.literal("PUT"),
  headers: z.record(z.string(), z.string()),
  mediaId: z.string(),
  storageKey: z.string(),
  expiresAt: z.string()
}).meta({ id: "MediaUploadUrlResponse" });
z.object({
  existing: z.literal(true),
  mediaId: z.string(),
  storageKey: z.string(),
  url: z.string()
}).meta({ id: "MediaExistingResponse" });
z.object({
  item: mediaItemSchema.extend({ url: z.string() })
}).meta({ id: "MediaConfirmResponse" });

const collectionSupportValues = z.enum(["drafts", "revisions", "preview", "scheduling", "search"]);
const collectionSourcePattern = /^(template:.+|import:.+|manual|discovered|seed)$/;
const fieldTypeValues = z.enum([
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
]);
const repeaterSubFieldSchema = z.object({
  slug: z.string().min(1).max(63).regex(slugPattern, "Invalid slug format"),
  type: z.enum(["string", "text", "number", "integer", "boolean", "datetime", "select"]),
  label: z.string().min(1),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional()
});
const fieldValidation = z.object({
  required: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  pattern: z.string().optional(),
  options: z.array(z.string()).optional(),
  subFields: z.array(repeaterSubFieldSchema).min(1).optional(),
  minItems: z.number().int().min(0).optional(),
  maxItems: z.number().int().min(1).optional(),
  allowedMimeTypes: z.array(
    z.string().regex(/^[a-z0-9][a-z0-9!#$&^_+\-.]*\/[a-z0-9!#$&^_+\-.]*$/i, "Invalid MIME type")
  ).min(1, "allowedMimeTypes must not be empty — omit the field to allow all types").max(64, "allowedMimeTypes may contain at most 64 entries").optional()
}).optional();
const fieldWidgetOptions = z.record(z.string(), z.unknown()).optional();
const createCollectionBody = z.object({
  slug: z.string().min(1).max(63).regex(slugPattern, "Invalid slug format"),
  label: z.string().min(1),
  labelSingular: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  supports: z.array(collectionSupportValues).optional(),
  source: z.string().regex(collectionSourcePattern).optional(),
  urlPattern: z.string().optional(),
  hasSeo: z.boolean().optional()
}).meta({ id: "CreateCollectionBody" });
const updateCollectionBody = z.object({
  label: z.string().min(1).optional(),
  labelSingular: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  supports: z.array(collectionSupportValues).optional(),
  urlPattern: z.string().nullish(),
  hasSeo: z.boolean().optional(),
  commentsEnabled: z.boolean().optional(),
  commentsModeration: z.enum(["all", "first_time", "none"]).optional(),
  commentsClosedAfterDays: z.number().int().min(0).optional(),
  commentsAutoApproveUsers: z.boolean().optional()
}).meta({ id: "UpdateCollectionBody" });
const createFieldBody = z.object({
  slug: z.string().min(1).max(63).regex(slugPattern, "Invalid slug format"),
  label: z.string().min(1),
  type: fieldTypeValues,
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  validation: fieldValidation.nullable(),
  widget: z.string().optional(),
  options: fieldWidgetOptions,
  sortOrder: z.number().int().min(0).optional(),
  searchable: z.boolean().optional(),
  translatable: z.boolean().optional()
}).meta({ id: "CreateFieldBody" });
const updateFieldBody = z.object({
  label: z.string().min(1).optional(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  validation: fieldValidation.nullable(),
  widget: z.string().optional(),
  options: fieldWidgetOptions,
  sortOrder: z.number().int().min(0).optional(),
  searchable: z.boolean().optional(),
  translatable: z.boolean().optional()
}).meta({ id: "UpdateFieldBody" });
const fieldReorderBody = z.object({
  fieldSlugs: z.array(z.string().min(1))
}).meta({ id: "FieldReorderBody" });
const orphanRegisterBody = z.object({
  label: z.string().optional(),
  labelSingular: z.string().optional(),
  description: z.string().optional()
}).meta({ id: "OrphanRegisterBody" });
z.object({
  format: z.string().optional()
});
const collectionGetQuery = z.object({
  includeFields: z.string().transform((v) => v === "true").optional()
});
const collectionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  label: z.string(),
  labelSingular: z.string().nullable(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  supports: z.array(z.string()),
  source: z.string().nullable(),
  urlPattern: z.string().nullable(),
  hasSeo: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
}).meta({ id: "Collection" });
const fieldSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  slug: z.string(),
  label: z.string(),
  type: fieldTypeValues,
  required: z.boolean(),
  unique: z.boolean(),
  defaultValue: z.unknown().nullable(),
  validation: z.record(z.string(), z.unknown()).nullable(),
  widget: z.string().nullable(),
  options: z.record(z.string(), z.unknown()).nullable(),
  sortOrder: z.number().int(),
  searchable: z.boolean(),
  translatable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
}).meta({ id: "Field" });
z.object({ item: collectionSchema }).meta({ id: "CollectionResponse" });
z.object({
  item: collectionSchema.extend({ fields: z.array(fieldSchema) })
}).meta({ id: "CollectionWithFieldsResponse" });
z.object({ items: z.array(collectionSchema) }).meta({ id: "CollectionListResponse" });
z.object({ item: fieldSchema }).meta({ id: "FieldResponse" });
z.object({ items: z.array(fieldSchema) }).meta({ id: "FieldListResponse" });
const orphanedTableSchema = z.object({
  slug: z.string(),
  tableName: z.string(),
  rowCount: z.number().int()
}).meta({ id: "OrphanedTable" });
z.object({ items: z.array(orphanedTableSchema) }).meta({ id: "OrphanedTableListResponse" });

const createCommentBody = z.object({
  authorName: z.string().min(1).max(100),
  authorEmail: z.string().email(),
  body: z.string().min(1).max(5e3),
  parentId: z.string().optional(),
  /** Honeypot field — hidden in the form, filled only by bots */
  website_url: z.string().optional()
}).meta({ id: "CreateCommentBody" });
const commentStatusBody = z.object({
  status: z.enum(["approved", "pending", "spam", "trash"])
}).meta({ id: "CommentStatusBody" });
const commentBulkBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["approve", "spam", "trash", "delete"])
}).meta({ id: "CommentBulkBody" });
const commentListQuery = z.object({
  status: z.enum(["pending", "approved", "spam", "trash"]).optional(),
  collection: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().max(2048).optional()
}).meta({ id: "CommentListQuery" });
const commentStatusValues = z.enum(["pending", "approved", "spam", "trash"]);
const publicCommentSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  isRegisteredUser: z.boolean(),
  body: z.string(),
  parentId: z.string().nullable(),
  createdAt: z.string(),
  replies: z.array(z.any()).optional()
}).meta({ id: "PublicComment" });
const commentSchema = z.object({
  id: z.string(),
  collection: z.string(),
  contentId: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  body: z.string(),
  status: commentStatusValues,
  parentId: z.string().nullable(),
  ipHash: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
}).meta({ id: "Comment" });
z.object({
  items: z.array(publicCommentSchema),
  nextCursor: z.string().optional(),
  total: z.number().int()
}).meta({ id: "PublicCommentListResponse" });
z.object({
  items: z.array(commentSchema),
  nextCursor: z.string().optional()
}).meta({ id: "AdminCommentListResponse" });
z.object({
  pending: z.number().int(),
  approved: z.number().int(),
  spam: z.number().int(),
  trash: z.number().int()
}).meta({ id: "CommentCountsResponse" });
z.object({ affected: z.number().int() }).meta({ id: "CommentBulkResponse" });

const authenticatorTransport$1 = z.enum(["usb", "nfc", "ble", "internal", "hybrid"]);
const registrationCredential$1 = z.object({
  id: z.string(),
  rawId: z.string(),
  type: z.literal("public-key"),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    transports: z.array(authenticatorTransport$1).optional()
  }),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional()
});
const authenticationCredential = z.object({
  id: z.string(),
  rawId: z.string(),
  type: z.literal("public-key"),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional()
  }),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional()
});
const signupRequestBody = z.object({
  email: z.string().email()
}).meta({ id: "SignupRequestBody" });
const signupCompleteBody = z.object({
  token: z.string().min(1),
  credential: registrationCredential$1,
  name: z.string().optional()
}).meta({ id: "SignupCompleteBody" });
const inviteCreateBody = z.object({
  email: z.string().email(),
  role: roleLevel.optional()
}).meta({ id: "InviteCreateBody" });
const inviteRegisterOptionsBody = z.object({
  token: z.string().min(1),
  name: z.string().optional()
}).meta({ id: "InviteRegisterOptionsBody" });
const inviteCompleteBody = z.object({
  token: z.string().min(1),
  credential: registrationCredential$1,
  name: z.string().optional()
}).meta({ id: "InviteCompleteBody" });
const magicLinkSendBody = z.object({
  email: z.string().email()
}).meta({ id: "MagicLinkSendBody" });
const passkeyOptionsBody = z.object({
  email: z.string().email().optional()
}).meta({ id: "PasskeyOptionsBody" });
const passkeyVerifyBody = z.object({
  credential: authenticationCredential
}).meta({ id: "PasskeyVerifyBody" });
const passkeyRegisterOptionsBody = z.object({
  name: z.string().optional()
}).meta({ id: "PasskeyRegisterOptionsBody" });
const passkeyRegisterVerifyBody = z.object({
  credential: registrationCredential$1,
  name: z.string().optional()
}).meta({ id: "PasskeyRegisterVerifyBody" });
const passkeyRenameBody = z.object({
  name: z.string().min(1)
}).meta({ id: "PasskeyRenameBody" });
const authMeActionBody = z.object({
  action: z.string().min(1)
}).meta({ id: "AuthMeActionBody" });

const SAFE_URL_SCHEME_RE = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;
function isSafeHref(url) {
  return SAFE_URL_SCHEME_RE.test(url);
}

const menuItemType = z.string().min(1);
const safeHref = z.string().trim().refine(
  isSafeHref,
  "URL must use http, https, mailto, tel, a relative path, or a fragment identifier"
);
const createMenuBody = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  locale: z.string().min(1).optional(),
  /** When set, clones the items from the source menu. The new menu joins
   * the source's translation_group. */
  translationOf: z.string().min(1).optional()
}).meta({ id: "CreateMenuBody" });
const updateMenuBody = z.object({
  label: z.string().min(1).optional()
}).meta({ id: "UpdateMenuBody" });
const createMenuItemBody = z.object({
  type: menuItemType,
  label: z.string().min(1),
  referenceCollection: z.string().optional(),
  referenceId: z.string().optional(),
  customUrl: safeHref.optional(),
  target: z.string().optional(),
  titleAttr: z.string().optional(),
  cssClasses: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional()
}).meta({ id: "CreateMenuItemBody" });
const updateMenuItemBody = z.object({
  label: z.string().min(1).optional(),
  customUrl: safeHref.optional(),
  target: z.string().optional(),
  titleAttr: z.string().optional(),
  cssClasses: z.string().optional(),
  parentId: z.string().nullish(),
  sortOrder: z.number().int().min(0).optional()
}).meta({ id: "UpdateMenuItemBody" });
const menuItemDeleteQuery = z.object({
  id: z.string().min(1)
});
const menuItemUpdateQuery = z.object({
  id: z.string().min(1)
});
const reorderMenuItemsBody = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      parentId: z.string().nullable(),
      sortOrder: z.number().int().min(0)
    })
  )
}).meta({ id: "ReorderMenuItemsBody" });
const menuSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  locale: z.string(),
  translation_group: z.string().nullable()
}).meta({ id: "Menu" });
const menuItemSchema = z.object({
  id: z.string(),
  menu_id: z.string(),
  parent_id: z.string().nullable(),
  sort_order: z.number().int(),
  type: z.string(),
  reference_collection: z.string().nullable(),
  reference_id: z.string().nullable(),
  custom_url: z.string().nullable(),
  label: z.string(),
  title_attr: z.string().nullable(),
  target: z.string().nullable(),
  css_classes: z.string().nullable(),
  created_at: z.string(),
  locale: z.string(),
  translation_group: z.string().nullable()
}).meta({ id: "MenuItem" });
z.object({
  translationGroup: z.string().nullable(),
  translations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      label: z.string(),
      locale: z.string(),
      updatedAt: z.string()
    })
  )
}).meta({ id: "MenuTranslations" });
menuSchema.extend({
  itemCount: z.number().int()
}).meta({ id: "MenuListItem" });
menuSchema.extend({
  items: z.array(menuItemSchema)
}).meta({ id: "MenuWithItems" });

const collectionSlugPattern = /^[a-z][a-z0-9_]*$/;
const createTaxonomyDefBody = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z][a-z0-9_]*$/, "Name must be lowercase alphanumeric with underscores"),
  label: z.string().min(1).max(200),
  labelSingular: z.string().min(1).max(200).optional(),
  hierarchical: z.boolean().optional().default(false),
  collections: z.array(
    z.string().min(1).max(63).regex(collectionSlugPattern, "Invalid collection slug format")
  ).max(100).optional().default([]),
  locale: z.string().min(1).optional(),
  translationOf: z.string().min(1).optional()
}).meta({ id: "CreateTaxonomyDefBody" });
const createTermBody = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  parentId: z.string().nullish(),
  description: z.string().optional(),
  locale: z.string().min(1).optional(),
  translationOf: z.string().min(1).optional()
}).meta({ id: "CreateTermBody" });
const updateTermBody = z.object({
  slug: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  parentId: z.string().nullish(),
  description: z.string().optional()
}).meta({ id: "UpdateTermBody" });
const taxonomyDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  labelSingular: z.string().optional(),
  hierarchical: z.boolean(),
  collections: z.array(z.string()),
  locale: z.string(),
  translationGroup: z.string().nullable()
}).meta({ id: "TaxonomyDef" });
z.object({
  translationGroup: z.string().nullable(),
  translations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      label: z.string(),
      locale: z.string()
    })
  )
}).meta({ id: "TaxonomyDefTranslations" });
z.object({ taxonomies: z.array(taxonomyDefSchema) }).meta({ id: "TaxonomyListResponse" });
const termSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  label: z.string(),
  parentId: z.string().nullable(),
  description: z.string().optional(),
  locale: z.string(),
  translationGroup: z.string().nullable()
}).meta({ id: "Term" });
z.object({
  translationGroup: z.string().nullable(),
  translations: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      label: z.string(),
      locale: z.string()
    })
  )
}).meta({ id: "TermTranslations" });
const termWithCountSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  label: z.string(),
  parentId: z.string().nullable(),
  description: z.string().optional(),
  count: z.number().int(),
  children: z.array(z.lazy(() => termWithCountSchema)),
  locale: z.string(),
  translationGroup: z.string().nullable()
}).meta({ id: "TermWithCount" });
z.object({ terms: z.array(termWithCountSchema) }).meta({ id: "TermListResponse" });
z.object({ term: termSchema }).meta({ id: "TermResponse" });
z.object({
  term: termSchema.extend({
    count: z.number().int(),
    children: z.array(
      z.object({
        id: z.string(),
        slug: z.string(),
        label: z.string()
      })
    )
  })
}).meta({ id: "TermGetResponse" });

const sectionSource = z.enum(["theme", "user", "import"]);
const sectionsListQuery = z.object({
  source: sectionSource.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().max(2048).optional()
}).meta({ id: "SectionsListQuery" });
const createSectionBody = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  content: z.array(z.record(z.string(), z.unknown())),
  previewMediaId: z.string().optional(),
  source: z.enum(["user", "import"]).optional(),
  themeId: z.string().optional()
}).meta({ id: "CreateSectionBody" });
const updateSectionBody = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  content: z.array(z.record(z.string(), z.unknown())).optional(),
  previewMediaId: z.string().nullish()
}).meta({ id: "UpdateSectionBody" });
const sectionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  keywords: z.array(z.string()).nullable(),
  content: z.array(z.record(z.string(), z.unknown())),
  previewMediaId: z.string().nullable(),
  source: z.string(),
  themeId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
}).meta({ id: "Section" });
z.object({
  items: z.array(sectionSchema),
  nextCursor: z.string().optional()
}).meta({ id: "SectionListResponse" });

const mediaReferenceInput = z.object({
  mediaId: z.string(),
  alt: z.string().optional()
});
const socialSettings = z.object({
  twitter: z.string().optional(),
  github: z.string().optional(),
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  youtube: z.string().optional()
});
const seoSettingsInput = z.object({
  titleSeparator: z.string().max(10).optional(),
  defaultOgImage: mediaReferenceInput.optional(),
  robotsTxt: z.string().max(5e3).optional(),
  googleVerification: z.string().max(100).optional(),
  bingVerification: z.string().max(100).optional()
});
const settingsUpdateBody = z.object({
  title: z.string().optional(),
  tagline: z.string().optional(),
  logo: mediaReferenceInput.optional(),
  favicon: mediaReferenceInput.optional(),
  url: z.union([httpUrl, z.literal("")]).optional(),
  postsPerPage: z.number().int().min(1).max(100).optional(),
  dateFormat: z.string().optional(),
  timezone: z.string().optional(),
  social: socialSettings.optional(),
  seo: seoSettingsInput.optional()
}).meta({ id: "SettingsUpdateBody" });
const mediaReferenceResponse = z.object({
  mediaId: z.string(),
  alt: z.string().optional(),
  /** Resolved media file URL; absent if the underlying row is missing. */
  url: z.string().optional(),
  /** Stored MIME type (e.g. `image/svg+xml`). Populated alongside `url`. */
  contentType: z.string().optional(),
  /** Pixel width if known. Populated alongside `url`. */
  width: z.number().int().optional(),
  /** Pixel height if known. Populated alongside `url`. */
  height: z.number().int().optional()
});
const seoSettingsResponse = z.object({
  titleSeparator: z.string().max(10).optional(),
  defaultOgImage: mediaReferenceResponse.optional(),
  robotsTxt: z.string().max(5e3).optional(),
  googleVerification: z.string().max(100).optional(),
  bingVerification: z.string().max(100).optional()
});
z.object({
  title: z.string().optional(),
  tagline: z.string().optional(),
  logo: mediaReferenceResponse.optional(),
  favicon: mediaReferenceResponse.optional(),
  url: z.string().optional(),
  postsPerPage: z.number().int().optional(),
  dateFormat: z.string().optional(),
  timezone: z.string().optional(),
  social: socialSettings.optional(),
  seo: seoSettingsResponse.optional()
}).meta({ id: "SiteSettings" });

const searchQuery = z.object({
  q: z.string().min(1),
  collections: z.string().optional(),
  status: z.string().optional(),
  locale: localeCode.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
}).meta({ id: "SearchQuery" });
const searchSuggestQuery = z.object({
  q: z.string().min(1),
  collections: z.string().optional(),
  locale: localeCode.optional(),
  limit: z.coerce.number().int().min(1).max(20).optional()
}).meta({ id: "SearchSuggestQuery" });
const searchRebuildBody = z.object({
  collection: z.string().min(1)
}).meta({ id: "SearchRebuildBody" });
const searchEnableBody = z.object({
  collection: z.string().min(1),
  enabled: z.boolean(),
  weights: z.record(z.string(), z.number()).optional()
}).meta({ id: "SearchEnableBody" });
const searchResultSchema = z.object({
  collection: z.string(),
  id: z.string(),
  slug: z.string().nullable(),
  locale: z.string(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  score: z.number()
}).meta({ id: "SearchResult" });
z.object({
  items: z.array(searchResultSchema),
  nextCursor: z.string().optional()
}).meta({ id: "SearchResponse" });

const importProbeBody = z.object({
  url: httpUrl
});
const wpPluginAnalyzeBody = z.object({
  url: httpUrl,
  token: z.string().min(1)
});
const wpPluginExecuteBody = z.object({
  url: httpUrl,
  token: z.string().min(1),
  config: z.record(z.string(), z.unknown())
});
const wpPrepareBody = z.object({
  postTypes: z.array(
    z.object({
      name: z.string().min(1),
      collection: z.string().min(1),
      fields: z.array(
        z.object({
          slug: z.string().min(1),
          label: z.string().min(1),
          type: z.string().min(1),
          required: z.boolean(),
          searchable: z.boolean().optional()
        })
      ).optional()
    })
  )
});
const wpMediaImportBody = z.object({
  attachments: z.array(z.record(z.string(), z.unknown())),
  stream: z.boolean().optional()
});
const wpRewriteUrlsBody = z.object({
  urlMap: z.record(z.string(), z.string()),
  collections: z.array(z.string()).optional()
});

const authenticatorTransport = z.enum(["usb", "nfc", "ble", "internal", "hybrid"]);
const registrationCredential = z.object({
  id: z.string(),
  rawId: z.string(),
  type: z.literal("public-key"),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    transports: z.array(authenticatorTransport).optional()
  }),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional()
});
const setupBody = z.object({
  title: z.string().min(1),
  tagline: z.string().optional(),
  includeContent: z.boolean()
});
const setupAdminBody = z.object({
  email: z.string().email(),
  name: z.string().optional()
});
const setupAdminVerifyBody = z.object({
  credential: registrationCredential
});
z.object({
  handle: z.string().trim().min(1)
});
z.object({
  handle: z.string().trim().min(1)
});

const usersListQuery = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
}).meta({ id: "UsersListQuery" });
const userUpdateBody = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: roleLevel.optional()
}).meta({ id: "UserUpdateBody" });
const allowedDomainCreateBody = z.object({
  domain: z.string().min(1),
  defaultRole: roleLevel
}).meta({ id: "AllowedDomainCreateBody" });
const allowedDomainUpdateBody = z.object({
  enabled: z.boolean().optional(),
  defaultRole: roleLevel.optional()
}).meta({ id: "AllowedDomainUpdateBody" });
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.number().int(),
  emailVerified: z.boolean(),
  disabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLogin: z.string().nullable(),
  credentialCount: z.number().int().optional(),
  oauthProviders: z.array(z.string()).optional()
}).meta({ id: "User" });
z.object({
  items: z.array(userSchema),
  nextCursor: z.string().optional()
}).meta({ id: "UserListResponse" });
z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.number().int(),
  emailVerified: z.boolean(),
  disabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLogin: z.string().nullable(),
  credentials: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      deviceType: z.string().nullable(),
      createdAt: z.string(),
      lastUsedAt: z.string()
    })
  ),
  oauthAccounts: z.array(
    z.object({
      provider: z.string(),
      createdAt: z.string()
    })
  )
}).meta({ id: "UserDetail" });

const widgetType = z.enum(["content", "menu", "component"]);
const createWidgetAreaBody = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional()
}).meta({ id: "CreateWidgetAreaBody" });
const createWidgetBody = z.object({
  type: widgetType,
  title: z.string().optional(),
  content: z.array(z.record(z.string(), z.unknown())).optional(),
  menuName: z.string().optional(),
  componentId: z.string().optional(),
  componentProps: z.record(z.string(), z.unknown()).optional()
}).meta({ id: "CreateWidgetBody" });
const updateWidgetBody = z.object({
  type: widgetType.optional(),
  title: z.string().optional(),
  content: z.array(z.record(z.string(), z.unknown())).optional(),
  menuName: z.string().optional(),
  componentId: z.string().optional(),
  componentProps: z.record(z.string(), z.unknown()).optional()
}).meta({ id: "UpdateWidgetBody" });
const reorderWidgetsBody = z.object({
  widgetIds: z.array(z.string().min(1))
}).meta({ id: "ReorderWidgetsBody" });
const widgetAreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
}).meta({ id: "WidgetArea" });
const widgetSchema = z.object({
  id: z.string(),
  type: widgetType,
  title: z.string().optional(),
  content: z.array(z.record(z.string(), z.unknown())).optional(),
  menuName: z.string().optional(),
  componentId: z.string().optional(),
  componentProps: z.record(z.string(), z.unknown()).optional()
}).meta({ id: "Widget" });
const widgetAreaWithWidgetsSchema = widgetAreaSchema.extend({
  widgets: z.array(widgetSchema)
}).meta({ id: "WidgetAreaWithWidgets" });
widgetAreaWithWidgetsSchema.extend({
  widgetCount: z.number().int()
}).meta({ id: "WidgetAreaWithWidgetsAndCount" });

const redirectType = z.coerce.number().int().refine((n) => [301, 302, 307, 308].includes(n), {
  message: "Redirect type must be 301, 302, 307, or 308"
});
const CRLF = /[\r\n]/;
const urlPath = z.string().min(1).refine((s) => s.startsWith("/") && !s.startsWith("//"), {
  message: "Must be a path starting with / (no protocol-relative URLs)"
}).refine((s) => !CRLF.test(s), {
  message: "URL must not contain newline characters"
}).refine(
  (s) => {
    try {
      return !decodeURIComponent(s).split("/").includes("..");
    } catch {
      return false;
    }
  },
  { message: "URL must not contain path traversal segments" }
);
const createRedirectBody = z.object({
  source: urlPath,
  destination: urlPath,
  type: redirectType.optional().default(301),
  enabled: z.boolean().optional().default(true),
  groupName: z.string().nullish()
}).meta({ id: "CreateRedirectBody" });
const updateRedirectBody = z.object({
  source: urlPath.optional(),
  destination: urlPath.optional(),
  type: redirectType.optional(),
  enabled: z.boolean().optional(),
  groupName: z.string().nullish()
}).refine((o) => Object.values(o).some((v) => v !== void 0), {
  message: "At least one field must be provided"
}).meta({ id: "UpdateRedirectBody" });
const redirectsListQuery = cursorPaginationQuery.extend({
  search: z.string().optional(),
  group: z.string().optional(),
  enabled: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  auto: z.enum(["true", "false"]).transform((v) => v === "true").optional()
}).meta({ id: "RedirectsListQuery" });
const notFoundListQuery = cursorPaginationQuery.extend({
  search: z.string().optional()
}).meta({ id: "NotFoundListQuery" });
const notFoundSummaryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});
const notFoundPruneBody = z.object({
  olderThan: z.string().datetime({ message: "olderThan must be an ISO 8601 datetime" })
}).meta({ id: "NotFoundPruneBody" });
const redirectSchema = z.object({
  id: z.string(),
  source: z.string(),
  destination: z.string(),
  type: z.number().int(),
  isPattern: z.boolean(),
  enabled: z.boolean(),
  hits: z.number().int(),
  lastHitAt: z.string().nullable(),
  groupName: z.string().nullable(),
  auto: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
}).meta({ id: "Redirect" });
z.object({
  items: z.array(redirectSchema),
  nextCursor: z.string().optional(),
  loopRedirectIds: z.array(z.string()).optional()
}).meta({ id: "RedirectListResponse" });
const notFoundEntrySchema = z.object({
  id: z.string(),
  path: z.string(),
  referrer: z.string().nullable(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string()
}).meta({ id: "NotFoundEntry" });
z.object({
  items: z.array(notFoundEntrySchema),
  nextCursor: z.string().optional()
}).meta({ id: "NotFoundListResponse" });
const notFoundSummarySchema = z.object({
  path: z.string(),
  count: z.number().int(),
  lastSeen: z.string(),
  topReferrer: z.string().nullable()
}).meta({ id: "NotFoundSummary" });
z.object({ items: z.array(notFoundSummarySchema) }).meta({ id: "NotFoundSummaryResponse" });

export { notFoundSummaryQuery as $, contentScheduleBody as A, contentTermsBody as B, contentUpdateBody as C, contentListQuery as D, contentCreateBody as E, importProbeBody as F, wpMediaImportBody as G, wpPrepareBody as H, wpRewriteUrlsBody as I, wpPluginAnalyzeBody as J, wpPluginExecuteBody as K, contentBylineInputSchema as L, contentSeoInput as M, DEFAULT_MAX_UPLOAD_SIZE as N, mediaUploadUrlBody as O, mediaConfirmBody as P, mediaUpdateBody as Q, formatFileSize as R, mediaListQuery as S, createMenuItemBody as T, updateMenuItemBody as U, localeFilterQuery as V, menuItemUpdateQuery as W, menuItemDeleteQuery as X, reorderMenuItemsBody as Y, updateMenuBody as Z, createMenuBody as _, allowedDomainUpdateBody as a, notFoundListQuery as a0, notFoundPruneBody as a1, updateRedirectBody as a2, redirectsListQuery as a3, createRedirectBody as a4, fieldReorderBody as a5, updateFieldBody as a6, createFieldBody as a7, collectionGetQuery as a8, updateCollectionBody as a9, createCollectionBody as aa, orphanRegisterBody as ab, searchEnableBody as ac, searchRebuildBody as ad, searchSuggestQuery as ae, searchQuery as af, updateSectionBody as ag, sectionsListQuery as ah, createSectionBody as ai, settingsUpdateBody as aj, setupAdminVerifyBody as ak, setupAdminBody as al, setupBody as am, updateTermBody as an, createTermBody as ao, createTaxonomyDefBody as ap, reorderWidgetsBody as aq, updateWidgetBody as ar, createWidgetBody as as, createWidgetAreaBody as at, allowedDomainCreateBody as b, bylineUpdateBody as c, bylinesListQuery as d, bylineCreateBody as e, commentBulkBody as f, commentStatusBody as g, commentListQuery as h, usersListQuery as i, inviteCompleteBody as j, inviteRegisterOptionsBody as k, inviteCreateBody as l, magicLinkSendBody as m, authMeActionBody as n, passkeyRegisterOptionsBody as o, passkeyOptionsBody as p, passkeyRegisterVerifyBody as q, passkeyVerifyBody as r, passkeyRenameBody as s, signupCompleteBody as t, userUpdateBody as u, signupRequestBody as v, createCommentBody as w, contentTrashQuery as x, contentPreviewUrlBody as y, contentPublishBody as z };
