# JSON CMS Guide

Your portfolio now uses a simple JSON-based CMS. All content is stored in easy-to-edit JSON files in the `src/data/` folder.

## How to Edit Content

### 1. Profile Information
**File:** `src/data/profile.json`

Edit your personal information:
```json
{
  "firstName": "Angel",
  "lastName": "Marie Sabido",
  "title": "Designer & Developer",
  "intro": "Welcome to my portfolio!...",
  "aboutParagraph1": "First paragraph about you...",
  "aboutParagraph2": "Second paragraph about you...",
  "birthday": "September 30, 2003",
  "degree": "BS in Information Technology",
  "location": "Lapu-Lapu City, Cebu",
  "email": "sabidoangel.uc@gmail.com",
  "interests": "Web Development & Graphic Design",
  "skillsDescription": "My expertise spans..."
}
```

### 2. Projects
**File:** `src/data/projects.json`

Add, edit, or remove projects:
```json
[
  {
    "title": "Project Name",
    "description": "Project description...",
    "link": "https://project-url.com",
    "icon": "utensils",
    "tags": ["React", "Tailwind", "Restaurant"]
  }
]
```

**Available Icons:**
- `utensils` - Restaurant/food
- `car` - Automotive
- `bolt` - Electrical/energy
- `wind` - HVAC/air
- `droplet` - Plumbing/water

**To add a new project:**
1. Copy an existing project object
2. Update all fields
3. Add it to the array
4. Save the file

### 3. Skills
**File:** `src/data/skills.json`

Manage your skills:
```json
[
  {
    "name": "Web Development",
    "category": "core",
    "icon": "fa-solid fa-code"
  },
  {
    "name": "PHP",
    "category": "tools",
    "icon": "fa-brands fa-php"
  }
]
```

**Categories:**
- `core` - Main skills (displayed as lines)
- `tools` - Tools/technologies (displayed as stamps)

**Common Icons:**
- `fa-solid fa-code` - General coding
- `fa-solid fa-paintbrush` - Design
- `fa-solid fa-pen-nib` - UI/UX
- `fa-solid fa-palette` - Graphic design
- `fa-brands fa-php` - PHP
- `fa-solid fa-rocket` - Astro
- `fa-brands fa-java` - Java

Find more icons at: https://fontawesome.com/icons

### 4. Experience
**File:** `src/data/experience.json`

Add work experience:
```json
[
  {
    "title": "Web Development Internship",
    "company": "N-Compass TV",
    "date": "January 2026 - May 2026"
  }
]
```

### 5. Contact Information
**File:** `src/data/contact.json`

Update contact details:
```json
{
  "email": "sabidoangel.uc@gmail.com",
  "phone": "+63 123 456 7890",
  "github": "https://github.com/yourusername",
  "linkedin": "https://linkedin.com/in/yourusername",
  "resumeLink": "/resume.pdf"
}
```

## How to See Changes

1. Edit any JSON file in `src/data/`
2. Save the file
3. The dev server will automatically reload
4. Refresh your browser to see changes

## Tips

- **Valid JSON:** Make sure your JSON is valid (use a JSON validator if needed)
- **Quotes:** Always use double quotes `"` for strings
- **Commas:** Don't forget commas between items, but no comma after the last item
- **Arrays:** Use `[]` for lists (projects, skills, experience)
- **Objects:** Use `{}` for single items (profile, contact)

## Common Mistakes

❌ **Wrong:**
```json
{
  "name": "Angel",  // No comments allowed
  'title': 'Developer',  // Must use double quotes
  "email": "test@email.com"  // Missing comma if more items follow
}
```

✅ **Correct:**
```json
{
  "name": "Angel",
  "title": "Developer",
  "email": "test@email.com"
}
```

## Need Help?

- JSON Validator: https://jsonlint.com/
- Font Awesome Icons: https://fontawesome.com/icons
- If something breaks, check the browser console for errors

## Backup

Before making major changes, copy your JSON files as backup:
- `profile.json` → `profile.backup.json`
- Then make your changes to the original

This way you can always restore if something goes wrong!
