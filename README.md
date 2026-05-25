# 🌟 Personal Portfolio - Astro

A modern, responsive personal portfolio website built with **Astro** featuring a vintage letter theme with elegant animations.

## 📋 Project Overview

This portfolio showcases my skills, projects, and experience as an IT student and aspiring web developer. The site features a unique letter/postal theme with smooth animations and interactive elements.

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
│   │   ├── Education.astro
│   │   ├── Experience.astro
│   │   ├── Footer.astro
│   │   ├── Header.astro
│   │   ├── Home.astro
│   │   ├── Loader.astro
│   │   ├── Projects.astro
│   │   ├── Ribbon.astro
│   │   └── Skills.astro
│   ├── data/
│   │   └── portfolio.ts
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── public/
│   └── portfolio.png
├── astro.config.mjs
├── package.json
└── README.md
```

## 📝 Content Management

All content is managed through `src/data/portfolio.ts`:

### Data Structure

```typescript
// Profile information
export const profile = {
  name: "Your Name",
  role: "Your Role",
  intro: "Your introduction",
  about_content: "About you",
  // ... more fields
}

// Skills organized by category
export const skills = [
  {
    category: "Core Skills",
    skills_list: "Skill 1, Skill 2, ..."
  },
  // ... more categories
]

// Projects with details
export const projects = [
  {
    title: "Project Name",
    description: "Description",
    tags: "tag1, tag2",
    project_url: "https://...",
    icon: "fa-solid fa-icon"
  },
  // ... more projects
]

// Contact information
export const contact = [
  {
    platform: "Email",
    value: "your@email.com",
    icon: "fa-solid fa-envelope"
  },
  // ... more contacts
]
```

## 🌐 Deployment

This is a static Astro site that can be deployed to any static hosting platform.

### Recommended: Vercel
- Seamless deployment with automatic builds from GitHub
- Excellent performance and global CDN
- Generous free tier (100GB bandwidth/month)
- Official Astro adapter with great support
- Simple setup: connect repo → automatic deployments

### Other Options
- **Netlify**: Similar to Vercel with drag-and-drop deployment
- **Cloudflare Pages**: Fast global CDN with unlimited bandwidth
- **GitHub Pages**: Free hosting for public repositories
- **Render**: Simple deployment with automatic SSL

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



