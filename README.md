# 🌟 Personal Portfolio - Astro + EmDash CMS

A modern, responsive personal portfolio website built with **Astro** and **EmDash CMS** for easy content management.

## 📋 Project Overview

This portfolio showcases my skills, projects, and experience as an IT student and aspiring web developer. The site features a clean, modern design with smooth animations and is fully editable through EmDash CMS.

## ✨ Features

### Required Sections (All Implemented ✅)
- **Home / Profile** - Hero section with animated code card and tech badges
- **About Me** - Personal introduction with rotating profile border and typing animation
- **Skills** - Organized skill categories with interactive pill badges
- **Projects** - Project showcase with tags and links
- **Experience / OJT** - Work experience and internship details
- **Contact** - Contact information and form

### CMS Integration (EmDash)
All major content is **editable through EmDash CMS**:
- ✅ Name
- ✅ Title / Role
- ✅ Intro text
- ✅ About content
- ✅ Skills (organized by category)
- ✅ Projects (with descriptions, tags, and links)
- ✅ Contact information
- ✅ Resume link

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

- **Framework**: Astro 6.3.1
- **CMS**: EmDash 0.12.0
- **Styling**: Custom CSS with CSS Variables
- **Icons**: Font Awesome 6.5.2
- **Fonts**: Google Fonts (Poppins)
- **Database**: SQLite (via EmDash)
- **Deployment**: Vercel

## 📂 Project Structure

```
my_portfolio/
├── src/
│   ├── assets/
│   │   └── cloud.svg
│   ├── components/
│   │   ├── About.astro
│   │   ├── Contact.astro
│   │   ├── Divider.astro
│   │   ├── Experience.astro
│   │   ├── Header.astro
│   │   ├── Home.astro
│   │   ├── Projects.astro
│   │   └── Skills.astro
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── public/
│   ├── favicon.svg
│   └── main.jpg (profile image)
├── astro.config.mjs
├── package.json
├── data.db (EmDash database)
└── README.md
```

## 🎯 EmDash CMS Setup

### Accessing the Admin Panel

1. Start the development server: `npm run dev`
2. Navigate to: `http://localhost:4321/emdash/admin`
3. Set up your admin account on first visit

### Content Collections

The portfolio uses the following EmDash collections:

#### 1. **Profile Collection**
Fields:
- `name` (string) - Your full name
- `role` (string) - Your job title/role
- `intro` (string) - Introduction paragraph
- `about_content` (string) - About section content
- `resume_link` (string) - Link to your resume/CV

#### 2. **Skills Collection**
Fields:
- `category` (string) - Skill category name (e.g., "Programming Languages")
- `skills_list` (string) - Comma-separated list of skills

#### 3. **Projects Collection**
Fields:
- `title` (string) - Project name
- `description` (string) - Project description
- `icon` (string) - Font Awesome icon class (e.g., "fa-solid fa-laptop-code")
- `tags` (string) - Comma-separated tags
- `project_url` (string) - Link to project (optional)

#### 4. **Contact Collection**
Fields:
- `platform` (string) - Contact method (e.g., "Email", "Phone")
- `value` (string) - Contact value
- `icon` (string) - Font Awesome icon class

### How to Edit Content

1. Go to the EmDash admin panel
2. Select the collection you want to edit
3. Add, edit, or delete entries
4. Changes are reflected immediately on the site

## 🌐 Deployment

### Current Deployment: Vercel ✅

The site is configured for Vercel deployment with:
- Server-side rendering (SSR) enabled
- Vercel adapter integrated
- Automatic deployments on git push

### Deployment Steps

```bash
# Build the project
npm run build

# Deploy to Vercel (if Vercel CLI is installed)
vercel deploy
```

Or connect your GitHub repository to Vercel for automatic deployments.

---

## 🔍 Research: Cloudflare vs Vercel for Astro + EmDash CMS

### Comparison Summary

| Feature | Cloudflare Pages | Vercel |
|---------|------------------|--------|
| **Astro Support** | ✅ Excellent | ✅ Excellent |
| **SSR Support** | ✅ Yes (Workers) | ✅ Yes (Serverless) |
| **EmDash CMS Compatibility** | ⚠️ Limited (needs D1 or external DB) | ✅ Full support |
| **Database** | D1 (SQLite), KV, Durable Objects | File-based SQLite works |
| **Free Tier** | 100,000 requests/day | 100GB bandwidth/month |
| **Build Time** | Unlimited | 6000 minutes/month |
| **Deployment Speed** | ⚡ Very Fast | ⚡ Very Fast |
| **Edge Network** | ✅ Global (275+ cities) | ✅ Global |
| **Custom Domains** | ✅ Free SSL | ✅ Free SSL |
| **Analytics** | ✅ Built-in (free) | ✅ Built-in (paid) |
| **Ease of Setup** | Medium | Easy |

### Detailed Analysis

#### **Cloudflare Pages**

**Pros:**
- Excellent free tier with generous limits
- Built-in analytics and Web Analytics (free)
- Superior CDN with 275+ edge locations
- Great for static sites and edge computing
- D1 database (SQLite at the edge) is free
- Integrated with Cloudflare's security features

**Cons:**
- EmDash CMS requires database configuration changes
- SQLite file-based DB doesn't work directly (needs D1 migration)
- More complex setup for SSR with databases
- Requires Cloudflare Workers for dynamic content
- Learning curve for Cloudflare-specific features

**EmDash Compatibility:**
- ⚠️ **Requires modification**: EmDash uses file-based SQLite by default, which doesn't persist on Cloudflare Pages
- Would need to migrate to Cloudflare D1 or use external database (PostgreSQL, MySQL)
- Additional configuration needed in `astro.config.mjs`

#### **Vercel**

**Pros:**
- **Perfect for Astro + EmDash** - works out of the box
- Official Astro adapter (`@astrojs/vercel`)
- File-based SQLite works in serverless functions
- Extremely easy deployment (connect GitHub repo)
- Excellent developer experience
- Great documentation and community support
- Automatic preview deployments for PRs

**Cons:**
- Free tier has bandwidth limits (100GB/month)
- Analytics are paid feature
- Build minutes limited (6000/month - usually sufficient)
- Can get expensive at scale

**EmDash Compatibility:**
- ✅ **Works perfectly**: No configuration changes needed
- SQLite database persists correctly
- SSR works seamlessly
- This project is already configured for Vercel

### Performance Comparison

**For Static Content:**
- Both are excellent, Cloudflare has slight edge in global distribution

**For Dynamic Content (SSR + Database):**
- Vercel is simpler and works immediately
- Cloudflare requires database migration

### Cost Comparison (Free Tier)

**Cloudflare Pages:**
- 500 builds/month
- 100,000 requests/day
- Unlimited bandwidth
- D1: 5GB storage, 5M reads/day, 100K writes/day

**Vercel:**
- 100GB bandwidth/month
- 6000 build minutes/month
- 100 deployments/day
- Serverless function execution: 100GB-hours

---

## 🎯 Final Recommendation

### For a Simple Astro Portfolio (Static Only):
**I recommend Cloudflare Pages.**

**Reason:**
- Better free tier with unlimited bandwidth
- Faster global CDN
- Built-in free analytics
- Perfect for static sites
- More generous limits for personal projects

### For Astro + EmDash CMS (This Project):
**I recommend Vercel.**

**Reason:**
- **Works out of the box** - no database migration needed
- EmDash's SQLite database works perfectly with Vercel's serverless functions
- Official Astro adapter with excellent support
- Simpler deployment process (git push → auto deploy)
- Better developer experience for full-stack applications
- This project is already configured and tested on Vercel
- For a portfolio site, 100GB bandwidth is more than sufficient

### When to Choose Cloudflare:
- If you're building a static-only portfolio (no CMS)
- If you need unlimited bandwidth
- If you want to learn edge computing
- If you're willing to migrate EmDash to use D1 or external database

### When to Choose Vercel:
- If you're using EmDash CMS or any file-based database
- If you want the easiest deployment experience
- If you're already in the Vercel/Next.js ecosystem
- If you prioritize developer experience over infrastructure complexity

---

## 📝 Commands Reference

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npm run astro` | Run Astro CLI commands |

## 🔗 Links

- **Live Site**: [Deploy to see live URL]
- **EmDash Admin**: `http://localhost:4321/emdash/admin` (local)
- **GitHub**: [Your repository URL]

## 👤 Author

**Angel Marie Sabido**
- LinkedIn: [linkedin.com/in/gelmarie](https://linkedin.com/in/gelmarie)
- GitHub: [@mykxttyjay](https://github.com/mykxttyjay)
- Twitter: [@mykxttyjay](https://twitter.com/mykxttyjay)
- Instagram: [@gelmarieee](https://www.instagram.com/gelmarieee)

## 📄 License

This project is open source and available for personal use.

---

**Built with ❤️ using Astro and EmDash CMS**
