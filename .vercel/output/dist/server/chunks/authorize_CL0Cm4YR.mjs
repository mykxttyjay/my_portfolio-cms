import { h as hasPermission, c as canActOnOwn } from './index_Bxms_uoh.mjs';
import { a as apiError } from './error_Da04EfM-.mjs';

function requirePerm(user, permission) {
  if (!user) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }
  if (!hasPermission(user, permission)) {
    return apiError("FORBIDDEN", "Insufficient permissions", 403);
  }
  return null;
}
function requireOwnerPerm(user, ownerId, ownPermission, anyPermission) {
  if (!user) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }
  if (!canActOnOwn(user, ownerId, ownPermission, anyPermission)) {
    return apiError("FORBIDDEN", "Insufficient permissions", 403);
  }
  return null;
}

export { requireOwnerPerm as a, requirePerm as r };
