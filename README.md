# Personal Portfolio — Astro + EmDash CMS

Personal portfolio with a vintage letter / postal theme. Built with Astro and managed through [EmDash CMS](https://emdashcms.com/), backed by SQLite. Deployed on [Render](https://render.com).

## Sections

- **Home** — animated envelope reveal with name, role, and intro
- **About Me** — profile card with editable photo and personal info
- **Skills** — postage-stamp style cards split into core skills and tools
- **Projects** — browser-mockup cards with editable thumbnails (live screenshot fallback via Microlink)
- **Experience** — letter-styled work entries
- **Contact** — email + resume link

## Tech Stack

- **Astro 6** with `@astrojs/node` (standalone server)
- **EmDash 0.14** for the CMS, with SQLite storage
- **Fonts**: Playfair Display (Google Fonts) and Dancing Script (`@fontsource/dancing-script`)
- **Icons**: Font Awesome 6.5

## Getting Started

```bash
npm install
npm run bootstrap      # init DB, apply seed, wire default About Me photo
npm run dev
```

- Site: `http://localhost:4321`
- Admin: `http://localhost:4321/_emdash/admin` (first visit prompts you to create an account)

## Content Management

`seed/seed.json` is the single source of truth for both schema and default content. Editors work in `/_emdash/admin`; the live site reads from EmDash and falls back to the seed if the database is unreachable.

### Collections

| Collection | Editable fields |
|---|---|
| Home | first name, last name, title, intro |
| About Me | profile photo, photo alt, two about paragraphs, birthday, degree, location, email, specialization |
| Skills | name, category (`core`/`tools`), Font Awesome icon class, display order |
| Projects | title, description, **thumbnail** (image), **thumbnail alt**, project URL, icon, tags (JSON array), display order |
| Experience | job title, company, date range, display order |
| Contact | email, resume link |

### Project thumbnails

Each project card uses the uploaded **Thumbnail Image** when present. If none is uploaded, it falls back to a live screenshot from `api.microlink.io`, which captures whatever the project URL currently shows (including modals or popups). Upload a static thumbnail in the admin to lock in a specific shot.

### Adding or changing fields

1. Edit `seed/seed.json` (collection schema + initial content).
2. If components consume the field, update the matching type and mapper in `src/lib/cms.ts`.
3. Apply the change to the local database:
   ```bash
   npx emdash seed --on-conflict update
   ```
4. Use the field in the relevant Astro component.

## Deployment (Render)

This site runs as a Node web service with a Persistent Disk for the SQLite database and uploads.

1. Create a Web Service from this repo.
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm start` (runs `npm run bootstrap` automatically)
4. Add a Persistent Disk and set the mount path (e.g. `/var/data`).
5. Set environment variables:
   - `PERSISTENT_STORAGE_DIR` = the mount path
   - `NODE_VERSION` = `22.12.0` (matches `.node-version`)

`data.db` and `uploads/` will live inside `PERSISTENT_STORAGE_DIR` and survive every redeploy.

After a schema change, run on the Render shell:
```bash
npx emdash seed --on-conflict update
```

## Slack / Link Previews

The page emits Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`) so Slack renders a preview card. The image is `public/portfolio.png` served from `canonicalURL` (set in `src/pages/index.astro` — update this if your domain changes). Slack caches previews aggressively; append `?v=2` to the URL to force a refresh.

## Project Structure

```
src/
  components/         # Astro components for each section
  lib/cms.ts          # EmDash loader with seed.json fallback + image helpers
  live.config.ts      # EmDash live content collection config
  pages/index.astro   # Main page + SEO/OG meta
  styles/global.css
seed/seed.json        # Schema + default content (single source of truth)
scripts/bootstrap.mjs # DB init + seed + default photo wiring
public/               # Static assets (profile.jpg, portfolio.png, resume.pdf)
emdash-env.d.ts       # Auto-generated EmDash types
```

## Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run bootstrap` | Init DB, apply seed, wire default photo |
| `npm run dev` | Dev server at `localhost:4321` |
| `npm run build` | Production build |
| `npm start` | Start server (auto-bootstraps) |
| `npm run seed` | Re-apply seed (skip-on-conflict) |
| `npx emdash seed --on-conflict update` | Re-apply seed and overwrite existing rows |

## License

Open source for personal use.

## Final Recommendation

For a simple Astro portfolio, I recommend **Vercel**.

For Astro + EmDash CMS, I recommend **Render**.

Reason:
- Static Astro = plain HTML/CSS/JS, so a serverless CDN like Vercel is fastest and free.
- EmDash needs a writable filesystem for SQLite and media uploads, which serverless can't provide.
- Render's Persistent Disk keeps `data.db` and `uploads/` across redeploys.
