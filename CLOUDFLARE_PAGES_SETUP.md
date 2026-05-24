# Cloudflare Pages Deployment Setup

## Overview
Your portfolio is configured as a **static site** and is ready to deploy to Cloudflare Pages.

## Configuration Files

### `wrangler.json`
This file tells Cloudflare Pages where to find your built static files:
```json
{
  "name": "angelmariesabido",
  "type": "javascript",
  "pages_build_output_dir": "dist"
}
```

### `astro.config.mjs`
Your Astro config is set to `output: 'static'`, which means:
- No server-side rendering
- All pages are pre-built as HTML files
- Perfect for Cloudflare Pages static hosting

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Update portfolio with Emdash CMS integration"
   git push origin main
   ```

2. **Connect to Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **Pages**
   - Click **Create a project**
   - Select your GitHub repository
   - Build settings should auto-detect:
     - **Build command**: `bun run build`
     - **Build output directory**: `dist`
   - Click **Save and Deploy**

## Important Notes

- ✅ Your site is **static** - no KV namespaces or server bindings needed
- ✅ Build output is in the `dist/` folder
- ✅ All Emdash data is baked into the HTML at build time
- ✅ No need for the Cloudflare adapter

## Updating Content

To update your portfolio content:

1. Edit `.emdash/seed.json` with new data
2. Run `bun run build` locally to test
3. Push changes to GitHub
4. Cloudflare Pages will automatically rebuild and deploy

## Troubleshooting

If you see KV namespace errors during deployment:
- These can be safely ignored for static sites
- Your site will still deploy correctly
- The error occurs because Cloudflare tries to add optional features that aren't needed

## Local Development

To run the dev server locally:
```bash
# Using the provided script
./dev.ps1

# Or manually with Node v22.22.3
$env:PATH = "$env:APPDATA\fnm\node-versions\v22.22.3\installation;$env:PATH"
bun run dev
```

Then visit `http://localhost:3000` in your browser.
