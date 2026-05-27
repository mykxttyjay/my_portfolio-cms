# 🌟 Personal Portfolio - Astro

A modern, responsive personal portfolio website built with **Astro** featuring a vintage letter theme with elegant animations and a simple JSON-based CMS for easy content management.

## 📋 Project Overview

This portfolio showcases skills, projects, and experience with a unique letter/postal theme, smooth animations, and interactive elements. All content is managed through easy-to-edit JSON files—no database required!

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
- JSON-based CMS for easy content management

## 🚀 Getting Started

### Prerequisites
- Node.js >= 22.12.0
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎨 Tech Stack

- **Framework**: Astro 6.3+
- **Styling**: Custom CSS with vintage letter theme
- **Content Management**: JSON-based CMS (no database required)
- **Icons**: Font Awesome 6.5.2
- **Fonts**: Google Fonts (Poppins, Playfair Display, EB Garamond, Dancing Script)
- **Deployment**: Vercel

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
│   ├── data/              # JSON CMS files
│   │   ├── profile.json   # Personal info & about
│   │   ├── projects.json  # Portfolio projects
│   │   ├── skills.json    # Skills & tools
│   │   ├── experience.json # Work experience
│   │   └── contact.json   # Contact information
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── public/
│   ├── portfolio.png
│   ├── profile.jpg
│   └── resume.pdf
├── astro.config.mjs
├── package.json
├── CMS-GUIDE.md          # Detailed CMS editing guide
└── README.md
```

## 📝 Content Management

This portfolio uses a simple **JSON-based CMS** for easy content management. All content is stored in JSON files in the `src/data/` folder.

### Quick Edit Guide

**Profile Information** (`src/data/profile.json`)
- Name, title, intro text
- About paragraphs
- Personal details (birthday, degree, location, email, interests)
- Skills description

**Projects** (`src/data/projects.json`)
- Add/edit/remove projects
- Each project has: title, description, link, icon, tags

**Skills** (`src/data/skills.json`)
- Manage skills with categories (core/tools)
- Font Awesome icons for each skill

**Experience** (`src/data/experience.json`)
- Work experience entries
- Job title, company, date range

**Contact** (`src/data/contact.json`)
- Email, phone, social links
- Resume link

### How to Edit

1. Open any JSON file in `src/data/`
2. Edit the values (keep valid JSON syntax)
3. Save the file
4. Refresh browser to see changes

📖 **See `CMS-GUIDE.md` for detailed instructions, examples, and tips!**

### Benefits

✓ **No Database** - Just edit JSON files  
✓ **Version Control** - Track changes with Git  
✓ **Simple** - No complex setup or admin panel  
✓ **Fast** - Data is bundled at build time  
✓ **Type-Safe** - JSON structure validated during build

## 🌐 Deployment

This is a static Astro site that can be deployed to any static hosting platform.

### Recommended: Vercel
- Seamless deployment with automatic builds from GitHub
- Excellent performance and global CDN
- Generous free tier (100GB bandwidth/month)
- Official Astro adapter with great support
- Simple setup: connect repo → automatic deployments

### Deploy to Vercel

```bash
# Build the project
npm run build

# Deploy to Vercel
vercel deploy
```

Or connect your GitHub repository to Vercel for automatic deployments.

## 📝 Commands Reference

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npm run astro` | Run Astro CLI commands |

## 📄 License

This project is open source and available for personal use.

---



