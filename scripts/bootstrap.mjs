import { execSync } from 'node:child_process';
import path from 'node:path';

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
