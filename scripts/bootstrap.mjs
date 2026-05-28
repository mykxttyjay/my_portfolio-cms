import { execSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ulid } from 'ulidx';

const storageDir = process.env.PERSISTENT_STORAGE_DIR;
const dbPath = storageDir ? path.join(storageDir, 'data.db') : './data.db';
const uploadsDir = storageDir
  ? path.join(storageDir, 'uploads')
  : './uploads';

execSync(`emdash init --database ${dbPath}`, { stdio: 'inherit' });
execSync(
  `emdash seed --database ${dbPath} --uploads-dir ${uploadsDir}`,
  { stdio: 'inherit' }
);

ensureDefaultProfilePhoto();

/**
 * Make sure the About Me row references the bundled profile photo as a
 * default. The image lives at `public/profile.jpg` and is exposed at
 * `/profile.jpg` by Astro, so we point EmDash at that URL via an external
 * media reference rather than duplicating the bytes into `uploads/`.
 *
 * Idempotent: if a real upload exists (provider !== "external"), we leave
 * it alone. If the row's photo is empty or already points at our default,
 * we (re)write the external reference.
 */
function ensureDefaultProfilePhoto() {
  const db = new Database(dbPath);
  try {
    const aboutTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ec_about_me'"
      )
      .get();
    if (!aboutTable) return;

    const row = db
      .prepare(
        "SELECT id, photo FROM ec_about_me WHERE slug='main' LIMIT 1"
      )
      .get();
    if (!row) return;

    const removedMediaIds = cleanupLegacyDuplicate(db);

    const current = parseJsonOrNull(row.photo);

    // Treat the photo as missing if it references a media row that no
    // longer exists, OR if the row exists but the actual file has been
    // wiped from the uploads directory (common after a deploy that lost
    // the persistent disk or had PERSISTENT_STORAGE_DIR misconfigured).
    let pointsAtMissingMedia = false;
    if (current && current.id && current.provider !== 'external') {
      const mediaRow = db
        .prepare('SELECT storage_key FROM media WHERE id = ?')
        .get(current.id);
      if (!mediaRow) {
        pointsAtMissingMedia = true;
      } else if (mediaRow.storage_key) {
        const onDisk = path.join(uploadsDir, mediaRow.storage_key);
        if (!existsSync(onDisk)) {
          pointsAtMissingMedia = true;
          // The DB row is now an orphan with no backing file. Clean it up.
          db.prepare('DELETE FROM media WHERE id = ?').run(current.id);
          console.log(
            `[bootstrap] Removed orphan media row ${current.id} (file missing on disk)`
          );
        }
      }
    }

    const referencesRemoved =
      pointsAtMissingMedia ||
      (current && current.id && removedMediaIds.has(current.id));

    if (
      current &&
      current.provider &&
      current.provider !== 'external' &&
      !referencesRemoved
    ) {
      // Real user upload – do not overwrite.
      return;
    }

    if (current && current.src === '/profile.jpg' && !referencesRemoved) {
      // Already pointed at the default.
      return;
    }

    const photoValue = JSON.stringify({
      id: ulid(),
      src: '/profile.jpg',
      alt: 'Angel Marie Sabido',
      provider: 'external',
    });

    db.prepare(
      'UPDATE ec_about_me SET photo = ?, updated_at = ? WHERE id = ?'
    ).run(photoValue, new Date().toISOString(), row.id);

    console.log(
      '[bootstrap] Set About Me photo default to /profile.jpg (external reference)'
    );
  } finally {
    db.close();
  }
}

/**
 * If a previous bootstrap copied profile.jpg into uploads/ and added a
 * matching media row, remove both so we converge on the external default.
 * We only touch a media row whose filename and alt match our defaults.
 */
function cleanupLegacyDuplicate(db) {
  const removed = new Set();
  const orphans = db
    .prepare(
      "SELECT id, storage_key FROM media WHERE filename='profile.jpg' AND alt='Angel Marie Sabido'"
    )
    .all();
  if (orphans.length === 0) return removed;

  for (const item of orphans) {
    if (item.storage_key) {
      const filePath = path.join(uploadsDir, item.storage_key);
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
    }
    db.prepare('DELETE FROM media WHERE id = ?').run(item.id);
    removed.add(item.id);
  }
  console.log(
    `[bootstrap] Removed ${orphans.length} duplicated profile.jpg upload(s) from media library`
  );
  return removed;
}

function parseJsonOrNull(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
