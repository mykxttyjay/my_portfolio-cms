import { e as escapeHtml } from './escape_-hxVH-Rz.mjs';
import { v as validateIdentifier } from './validate_AseaonR5.mjs';
import { C as CommentRepository } from './comments_DmlPXjOm.mjs';

const NOTIFICATION_SOURCE = "emdash-comments";
const MAX_EXCERPT_LENGTH = 500;
const CRLF_RE = /[\r\n]/g;
function buildCommentNotificationEmail(to, data) {
  const title = data.contentTitle || `${data.collection} item`;
  const subject = `New comment on "${title}"`.replace(CRLF_RE, " ");
  const excerpt = data.commentBody.length > MAX_EXCERPT_LENGTH ? data.commentBody.slice(0, MAX_EXCERPT_LENGTH) + "..." : data.commentBody;
  const adminUrl = `${data.adminBaseUrl}/admin/comments`;
  const text = [
    `${data.commentAuthorName} commented on "${title}":`,
    "",
    excerpt,
    "",
    `View in admin: ${adminUrl}`
  ].join("\n");
  const html = [
    `<p><strong>${escapeHtml(data.commentAuthorName)}</strong> commented on &ldquo;${escapeHtml(title)}&rdquo;:</p>`,
    `<blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:12px 0;color:#555">${escapeHtml(excerpt)}</blockquote>`,
    `<p><a href="${escapeHtml(adminUrl)}">View in admin</a></p>`
  ].join("\n");
  return { to, subject, text, html };
}
async function sendCommentNotification(params) {
  const { email, comment, contentAuthor, adminBaseUrl } = params;
  if (comment.status !== "approved") return false;
  if (!contentAuthor?.email) return false;
  if (!email.isAvailable()) return false;
  if (comment.authorEmail.toLowerCase() === contentAuthor.email.toLowerCase()) return false;
  const message = buildCommentNotificationEmail(contentAuthor.email, {
    commentAuthorName: comment.authorName,
    commentBody: comment.body,
    contentTitle: params.contentTitle || "",
    collection: comment.collection,
    adminBaseUrl
  });
  await email.send(message, NOTIFICATION_SOURCE);
  return true;
}
async function lookupContentAuthor(db, collection, contentId) {
  validateIdentifier(collection, "collection");
  const contentRow = await db.selectFrom(`ec_${collection}`).select(["slug", "author_id"]).where("id", "=", contentId).executeTakeFirst();
  if (!contentRow) return null;
  const typed = contentRow;
  let author;
  if (typed.author_id) {
    const userRow = await db.selectFrom("users").select(["id", "name", "email", "email_verified"]).where("id", "=", typed.author_id).executeTakeFirst();
    if (userRow && userRow.email_verified) {
      author = { id: userRow.id, email: userRow.email, name: userRow.name };
    }
  }
  return { slug: typed.slug, author };
}

async function createComment(db, input, collectionSettings, hooks, contentInfo) {
  const repo = new CommentRepository(db);
  const beforeCreateEvent = {
    comment: {
      collection: input.collection,
      contentId: input.contentId,
      parentId: input.parentId ?? null,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      authorUserId: input.authorUserId ?? null,
      body: input.body,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null
    },
    metadata: {}
  };
  const result = await hooks.runBeforeCreate(beforeCreateEvent);
  if (result === false) {
    return null;
  }
  const event = result;
  const priorApprovedCount = await repo.countApprovedByEmail(event.comment.authorEmail);
  const moderateEvent = {
    comment: event.comment,
    metadata: event.metadata,
    collectionSettings,
    priorApprovedCount
  };
  const decision = await hooks.runModerate(moderateEvent);
  const comment = await repo.create({
    collection: event.comment.collection,
    contentId: event.comment.contentId,
    parentId: event.comment.parentId,
    authorName: event.comment.authorName,
    authorEmail: event.comment.authorEmail,
    authorUserId: event.comment.authorUserId,
    body: event.comment.body,
    status: decision.status,
    ipHash: event.comment.ipHash,
    userAgent: event.comment.userAgent,
    moderationMetadata: Object.keys(event.metadata).length > 0 ? event.metadata : null
  });
  if (contentInfo) {
    const afterEvent = {
      comment: commentToStored(comment),
      metadata: event.metadata,
      content: {
        id: contentInfo.id,
        collection: contentInfo.collection,
        slug: contentInfo.slug,
        title: contentInfo.title
      },
      contentAuthor: contentInfo.author
    };
    hooks.fireAfterCreate(afterEvent);
  }
  return { comment, decision };
}
async function moderateComment(db, id, newStatus, moderator, hooks) {
  const repo = new CommentRepository(db);
  const existing = await repo.findById(id);
  if (!existing) return null;
  const previousStatus = existing.status;
  const updated = await repo.updateStatus(id, newStatus);
  if (!updated) return null;
  const afterEvent = {
    comment: commentToStored(updated),
    previousStatus,
    newStatus,
    moderator
  };
  hooks.fireAfterModerate(afterEvent);
  return updated;
}
function commentToStored(comment) {
  return {
    id: comment.id,
    collection: comment.collection,
    contentId: comment.contentId,
    parentId: comment.parentId,
    authorName: comment.authorName,
    authorEmail: comment.authorEmail,
    authorUserId: comment.authorUserId,
    body: comment.body,
    status: comment.status,
    moderationMetadata: comment.moderationMetadata,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

export { createComment as c, lookupContentAuthor as l, moderateComment as m, sendCommentNotification as s };
