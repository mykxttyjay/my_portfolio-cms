# Cloudflare Pages Deployment Setup

## Overview
Your portfolio is configured as a **static site** and is ready to deploy to Cloudflare Pages.

## Configuration

Your site uses:
- **Build command**: `bun run build`
- **Build output directory**: `dist`
- **Framework**: Astro (static output)

## Deployment Steps

1. **Push to GitHub** (already done ✓)
   ```bash
   git add .
   git commit -m "Update portfolio"
   git push origin main
   ```

2. **Connect to Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **Pages**
   - Click **Create a project** → **Connect to Git**
   - Select your GitHub repository (`mykxttyjay/my_portfolio`)
   - Click **Begin setup**

3. **Configure Build Settings**
   - **Project name**: `angelmariesabido` (or your preferred name)
   - **Production branch**: `main`
   - **Build command**: `bun run build`
   - **Build output directory**: `dist`
   - Click **Save and Deploy**

4. **Wait for Deployment**
   - Cloudflare will automatically build and deploy your site
   - You'll get a URL like `https://angelmariesabido.pages.dev`

## Important Notes

- ✅ Your site is **static** - no server needed
- ✅ Build output is in the `dist/` folder
- ✅ All Emdash data is baked into the HTML at build time
- ✅ No need for wrangler or worker configuration
- ✅ Cloudflare Pages will automatically redeploy when you push to GitHub

## Updating Content

To update your portfolio content:

1. Edit `.emdash/seed.json` with new data
2. Run `bun run build` locally to test
3. Push changes to GitHub
4. Cloudflare Pages will automatically rebuild and deploy

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

## Troubleshooting

If deployment fails:
1. Check that `dist/` folder contains `index.html`
2. Verify build command runs successfully locally: `bun run build`
3. Check Cloudflare Pages deployment logs for specific errors
4. Ensure GitHub repository is public or Cloudflare has access
