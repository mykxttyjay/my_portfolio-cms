# 🌟 Personal Portfolio - Astro + EmDash CMS

A modern, responsive personal portfolio website built with **Astro** featuring a vintage letter theme with elegant animations. Content is managed through **EmDash CMS** — a full-stack, Astro-native CMS with a visual admin panel, backed by SQLite.

## 📋 Project Overview

This portfolio showcases skills, projects, and experience with a unique letter/postal theme, smooth animations, and interactive elements. All content is editable through the EmDash admin panel at `/_emdash/admin`, with local JSON files serving as a fallback.

## ✨ Features

### Sections
- **Home** - Animated envelope with letter reveal and wax seal
- **About Me** - Combined profile card and letter format
- **Skills** - Vintage postage stamp design with skill categories
- **Projects** - Browser mockup cards with horizontal scrolling carousel
- **Experience** - Letter-styled experience cards
- **Contact** - Contact information section

### Design Highlights
- Vintage letter and postal theme throughout
- Smooth scroll animations and transitions
- Interactive floating sparkles
- Responsive design for all devices
- Custom wavy borders and postal elements

### CMS Highlights
- Visual admin panel at `/_emdash/admin`
- Live content collections — edits appear without rebuilding
- SQLite database (local) with JSON fallback
- All 5 content types editable from the admin UI

## 🚀 Getting Started

### Prerequisites
- Node.js >= 22.12.0
- npm

### Installation

```bash
# Install dependencies
npm install

# Initialize the database and seed content
npm run bootstrap

# Start development server
npm run dev
```

The admin panel is available at `http://localhost:4321/_emdash/admin`.  
The first visit will prompt you to create an admin account.

```bash
# Build for production
npm run build

# Start production server (runs bootstrap first automatically)
npm start
```

## 🎨 Tech Stack

- **Framework**: Astro 6.3+
- **Adapter**: @astrojs/node (standalone server)
- **CMS**: EmDash 0.14+ (Astro-native, SQLite)
- **Styling**: Custom CSS with vintage letter theme
- **Icons**: Font Awesome 6.5.2
- **Fonts**: Google Fonts (Poppins, Playfair Display, EB Garamond, Dancing Script)
- **Deployment**: Any Node.js host (Vercel, Railway, Render, Code Capsules, etc.)

## 📂 Project Structure

```
my_portfolio/
├── src/
│   ├── components/
│   │   ├── About.astro
│   │   ├── Contact.astro
│   │   ├── Divider.astro
│   │   ├── Experience.astro
│   │   ├── Footer.astro
│   │   ├── Home.astro
│   │   ├── Loader.astro
│   │   ├── Projects.astro
│   │   ├── Ribbon.astro
│   │   └── Skills.astro
│   ├── data/              # JSON fallback files (used if DB is unavailable)
│   │   ├── profile.json
│   │   ├── projects.json
│   │   ├── skills.json
│   │   ├── experience.json
│   │   └── contact.json
│   ├── lib/
│   │   └── cms.ts         # Centralized CMS loader (EmDash → JSON fallback)
│   ├── live.config.ts     # EmDash live content collection config
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── seed/
│   └── seed.json          # EmDash schema + initial content
├── scripts/
│   └── bootstrap.mjs      # DB init + seed script
├── public/
│   ├── portfolio.png
│   ├── profile.jpg
│   └── resume.pdf
├── emdash-env.d.ts        # EmDash TypeScript types
├── astro.config.mjs
├── package.json
└── README.md
```

## 📝 Content Management

Content is managed through the **EmDash admin panel**. After running `npm run bootstrap` and starting the dev server, go to:

```
http://localhost:4321/_emdash/admin
```

### Collections

| Collection | Fields |
|------------|--------|
| Profile | First/last name, title, intro, about paragraphs, birthday, degree, location, email, specialization, skills description |
| Projects | Title, description, URL, icon, tags, display order |
| Skills | Name, category (core/tools), Font Awesome icon, display order |
| Experience | Job title, company, date range, display order |
| Contact | Email, phone, GitHub, LinkedIn, resume link |

### How it works

1. Run `npm run bootstrap` once to set up the database and seed initial content
2. Start the dev server with `npm run dev`
3. Open `/_emdash/admin` and log in
4. Edit any collection — changes appear live without a rebuild

The `src/data/*.json` files are kept as a fallback. If EmDash is unreachable, components automatically read from those files instead.

## 🌐 Deployment

The site now runs as a **Node.js server** (not static). It requires a persistent filesystem for the SQLite database and uploaded media.

### Node.js hosts (Railway, Render, Fly.io, etc.)

```bash
npm install
npm run build
npm start          # runs bootstrap then starts the server
```

Set `PERSISTENT_STORAGE_DIR` to a mounted volume path to keep the database and uploads across deploys.

### Vercel / serverless

Serverless platforms don't support persistent SQLite. For those, either:
- Use a remote database adapter (Turso/libSQL, PostgreSQL) — see EmDash docs
- Or keep the static JSON files as the sole content source and revert `output` to `"static"` in `astro.config.mjs`

## 📝 Commands Reference

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run bootstrap` | Initialize DB and seed content |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build for production |
| `npm start` | Start production server (auto-bootstraps) |
| `npm run seed` | Re-apply seed file to the database |

## 📄 License

This project is open source and available for personal use.
