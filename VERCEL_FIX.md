# Vercel Deployment Fix

## Issue
The serverless function was crashing with a `500: INTERNAL_SERVER_ERROR` due to database configuration issues on Vercel's ephemeral file system.

## Root Cause
The SQLite database was configured to use `file:./data.db` which doesn't persist on Vercel's serverless environment. Each function invocation has a fresh file system, causing the database to be inaccessible.

## Solutions Applied

### 1. Updated `astro.config.mjs`
- Changed database path from `file:./data.db` to `file:.emdash/data.db`
- Added proper path resolution using `path.join()` and `fileURLToPath()`
- Enabled Vercel web analytics

**Before:**
```javascript
database: sqlite({ url: 'file:./data.db' })
```

**After:**
```javascript
database: sqlite({ 
  url: `file:${path.join(__dirname, '.emdash', 'data.db')}` 
})
```

### 2. Created `.vercelignore`
Excludes unnecessary files from Vercel deployment to reduce build size and improve performance:
- `.git`, `.gitignore`, `README.md`
- `node_modules`, `.env.local`
- `dist`, `.astro`, `.vscode`
- `bun.lock`

### 3. Created `vercel.json`
Configures Vercel build settings:
- Build command: `npm run build`
- Output directory: `.vercel/output`
- Function memory: 1024MB
- Max duration: 60 seconds

### 4. Updated `.gitignore`
Added database files to ignore list:
- `.emdash/data.db*` (all database files)
- `.vercel/` (Vercel build output)

### 5. Created `.env.example`
Documents environment configuration for developers.

## How It Works on Vercel

1. **Build Time**: Astro builds the project and creates serverless functions
2. **Runtime**: When a request comes in, the function initializes with the database path pointing to `.emdash/data.db`
3. **Database**: SQLite creates/accesses the database in the `.emdash` directory within the function's temporary file system
4. **Persistence**: For production data persistence, consider using:
   - Vercel KV (Redis)
   - Supabase PostgreSQL
   - MongoDB Atlas
   - Or another cloud database service

## Testing Locally

```bash
npm run build
npm run preview
```

## Deployment Steps

1. Push changes to your Git repository
2. Vercel will automatically detect changes and rebuild
3. The new configuration will be applied
4. Your site should now work without 500 errors

## Next Steps (Optional)

For better data persistence in production, consider:
1. Migrating from SQLite to a cloud database
2. Setting up Vercel KV for caching
3. Using environment variables for database credentials

## Files Modified
- `astro.config.mjs` - Database path configuration
- `.gitignore` - Added database and Vercel files
- Created: `.vercelignore`, `vercel.json`, `.env.example`
