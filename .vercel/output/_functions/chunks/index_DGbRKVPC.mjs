import { c as createComponent } from './astro-component_wp9zoKZU.mjs';
import 'piccolore';
import { T as createRenderInstruction, aw as generateCspDigest, bf as unescapeHTML, Q as renderTemplate, z as maybeRenderHead, a3 as addAttribute, b0 as renderHead } from './params-and-props_DwyEVPUa.mjs';
import { s as spreadAttributes, r as renderComponent } from './entrypoint_BekPkF6C.mjs';
import 'clsx';
import './adapt-sandbox-entry_H5gl0boC.mjs';
import 'better-sqlite3';
import 'kysely';
import 'image-size';
import '@emdash-cms/plugin-types';
import { n as getEmDashCollection } from './query-yA3-rFji_DI0XfGdU.mjs';
import 'mime/lite';

async function renderScript(result, id) {
  const inlined = result.inlinedScripts.get(id);
  let content = "";
  if (inlined != null) {
    if (inlined) {
      content = `<script type="module">${inlined}</script>`;
    }
  } else {
    const resolved = await result.resolve(id);
    content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"></script>`;
  }
  return createRenderInstruction({ type: "script", id, content });
}

function createSvgComponent({ meta, attributes, children, styles }) {
  const hasStyles = styles.length > 0;
  const Component = createComponent({
    async factory(result, props) {
      const normalizedProps = normalizeProps(attributes, props);
      if (hasStyles && result.cspDestination) {
        for (const style of styles) {
          const hash = await generateCspDigest(style, result.cspAlgorithm);
          result._metadata.extraStyleHashes.push(hash);
        }
      }
      return renderTemplate`<svg${spreadAttributes(normalizedProps)}>${unescapeHTML(children)}</svg>`;
    },
    propagation: hasStyles ? "self" : "none"
  });
  Object.defineProperty(Component, "toJSON", {
    value: () => meta,
    enumerable: false
  });
  return Object.assign(Component, meta);
}
const ATTRS_TO_DROP = ["xmlns", "xmlns:xlink", "version"];
const DEFAULT_ATTRS = {};
function dropAttributes(attributes) {
  for (const attr of ATTRS_TO_DROP) {
    delete attributes[attr];
  }
  return attributes;
}
function normalizeProps(attributes, props) {
  return dropAttributes({ ...DEFAULT_ATTRS, ...attributes, ...props });
}

const CloudIcon = createSvgComponent({"meta":{"src":"/_astro/cloud.DLimgXRL.svg","width":100,"height":60,"format":"svg"},"attributes":{"viewBox":"0 0 100 60"},"children":"\r\n  <path d=\"M 20 40 Q 10 40 10 30 Q 10 20 20 20 Q 25 10 35 10 Q 45 10 50 20 Q 60 15 70 20 Q 80 20 80 30 Q 80 40 70 40 Z\" fill=\"white\" opacity=\"0.8\" />\r\n","styles":[]});

const $$Home = createComponent(async ($$result, $$props, $$slots) => {
  let name = "Angel Marie";
  let role = "IT Student";
  let focus = "Web Dev & Tech";
  try {
    const { entries } = await getEmDashCollection("profile");
    if (entries && entries.length > 0 && entries[0].data) {
      name = entries[0].data.name || name;
      role = entries[0].data.role || role;
    }
  } catch (e) {
    console.error("Error fetching profile from EmDash:", e);
  }
  return renderTemplate`${maybeRenderHead()}<section class="home" id="home" data-astro-cid-xhaoqxbd> <div class="home-container" data-astro-cid-xhaoqxbd> <div class="year" data-astro-cid-xhaoqxbd>2024</div> <h1 class="portfolio-title" data-astro-cid-xhaoqxbd>PORTFOLIO</h1> <div class="illustration-placeholder" data-astro-cid-xhaoqxbd> <div class="character-box" data-astro-cid-xhaoqxbd> <div class="glow-orb" data-astro-cid-xhaoqxbd></div> <div class="dev-card" data-astro-cid-xhaoqxbd> <div class="card-header" data-astro-cid-xhaoqxbd> <span class="dot red" data-astro-cid-xhaoqxbd></span> <span class="dot yellow" data-astro-cid-xhaoqxbd></span> <span class="dot green" data-astro-cid-xhaoqxbd></span> </div> <div class="card-content" data-astro-cid-xhaoqxbd> <div class="code-line" data-astro-cid-xhaoqxbd><span class="keyword" data-astro-cid-xhaoqxbd>const</span> <span class="variable" data-astro-cid-xhaoqxbd>developer</span> = &#123;</div> <div class="code-line indent" data-astro-cid-xhaoqxbd><span class="property" data-astro-cid-xhaoqxbd>name</span>: <span class="string" data-astro-cid-xhaoqxbd>"${name}"</span>,</div> <div class="code-line indent" data-astro-cid-xhaoqxbd><span class="property" data-astro-cid-xhaoqxbd>role</span>: <span class="string" data-astro-cid-xhaoqxbd>"${role}"</span>,</div> <div class="code-line indent" data-astro-cid-xhaoqxbd><span class="property" data-astro-cid-xhaoqxbd>focus</span>: <span class="string" data-astro-cid-xhaoqxbd>"${focus}"</span></div> <div class="code-line" data-astro-cid-xhaoqxbd>&#125;;</div> </div> </div> <div class="tech-badge badge-1" data-astro-cid-xhaoqxbd><i class="fa-solid fa-code" data-astro-cid-xhaoqxbd></i> Frontend</div> <div class="tech-badge badge-2" data-astro-cid-xhaoqxbd><i class="fa-solid fa-database" data-astro-cid-xhaoqxbd></i> Database</div> <div class="tech-badge badge-3" data-astro-cid-xhaoqxbd><i class="fa-solid fa-graduation-cap" data-astro-cid-xhaoqxbd></i> Scholar</div> </div> </div> <p class="welcome-text" data-astro-cid-xhaoqxbd>WELCOME</p> </div> <div class="clouds" data-astro-cid-xhaoqxbd> ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-1", "data-astro-cid-xhaoqxbd": true })} ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-2", "data-astro-cid-xhaoqxbd": true })} ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-3", "data-astro-cid-xhaoqxbd": true })} </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Home.astro", void 0);

const $$Divider = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Divider;
  const { type = "light-to-dark" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div${addAttribute(`divider ${type}`, "class")} data-astro-cid-e4yecxcx> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100" preserveAspectRatio="none" data-astro-cid-e4yecxcx> <path d="M0,50 Q80,20 160,50 T320,50 T480,50 T640,50 T800,50 T960,50 T1120,50 T1280,50 T1440,50 L1440,100 L0,100 Z" class="divider-path" data-astro-cid-e4yecxcx></path> </svg> </div>`;
}, "C:/Users/sabido/my_portfolio/src/components/Divider.astro", void 0);

const $$About = createComponent(async ($$result, $$props, $$slots) => {
  let name = "Angel Marie Sabido";
  let intro = "Aspiring IT professional with a strong work ethic and a passion for learning and growth in the technology field. Committed to developing technical skills and contributing positively to team environments. Eager to gain hands-on experience and continuously improve to deliver quality results in any task or project.";
  let aboutContent = "Driven by curiosity and a desire to make an impact, I aim to leverage my skills to support organizational goals, create innovative digital solutions, and grow as a well-rounded IT professional.";
  let resumeLink = "https://linkedin.com/in/gelmarie";
  try {
    const { entries } = await getEmDashCollection("profile");
    if (entries && entries.length > 0 && entries[0].data) {
      name = entries[0].data.name || name;
      intro = entries[0].data.intro || intro;
      aboutContent = entries[0].data.about_content || aboutContent;
      resumeLink = entries[0].data.resume_link || resumeLink;
    }
  } catch (e) {
    console.error("Error fetching profile from EmDash:", e);
  }
  return renderTemplate`${maybeRenderHead()}<section class="about" id="about" data-astro-cid-v2cbyr3p> <div class="about-img" data-astro-cid-v2cbyr3p> <div class="rotating-border" data-astro-cid-v2cbyr3p></div> <div class="rotating-border-2" data-astro-cid-v2cbyr3p></div> <img src="main.jpg" alt="Angel Marie Sabido" data-astro-cid-v2cbyr3p> <div class="img-glow" data-astro-cid-v2cbyr3p></div> </div> <div class="about-content" data-astro-cid-v2cbyr3p> <h1 class="fade-in" data-astro-cid-v2cbyr3p>Hi, I'm <span class="gradient-text" data-astro-cid-v2cbyr3p>${name}</span></h1> <h3 class="typing-text fade-in-delay-1" data-astro-cid-v2cbyr3p>I'm a <span data-astro-cid-v2cbyr3p></span></h3> <p class="fade-in-delay-2" data-astro-cid-v2cbyr3p>${intro}</p> <br data-astro-cid-v2cbyr3p> <p class="fade-in-delay-2" data-astro-cid-v2cbyr3p>${aboutContent}</p> <div class="btn-group fade-in-delay-3" data-astro-cid-v2cbyr3p> <a href="#contact" class="btn" data-astro-cid-v2cbyr3p>Contact Me</a> <a href="#projects" class="btn btn-secondary" data-astro-cid-v2cbyr3p>View Projects</a> <a${addAttribute(resumeLink, "href")} target="_blank" class="btn btn-secondary" data-astro-cid-v2cbyr3p><i class="fa-solid fa-download" data-astro-cid-v2cbyr3p></i> Download CV</a> </div> <div class="social-icons fade-in-delay-4" data-astro-cid-v2cbyr3p> <a href="https://www.linkedin.com/in/gelmarie" target="_blank" title="LinkedIn" data-astro-cid-v2cbyr3p><i class="fa-brands fa-linkedin" data-astro-cid-v2cbyr3p></i></a> <a href="https://github.com/mykxttyjay" target="_blank" title="GitHub" data-astro-cid-v2cbyr3p><i class="fa-brands fa-github" data-astro-cid-v2cbyr3p></i></a> <a href="https://twitter.com/mykxttyjay" target="_blank" title="Twitter" data-astro-cid-v2cbyr3p><i class="fa-brands fa-x-twitter" data-astro-cid-v2cbyr3p></i></a> <a href="https://www.instagram.com/gelmarieee" target="_blank" title="Instagram" data-astro-cid-v2cbyr3p><i class="fa-brands fa-instagram" data-astro-cid-v2cbyr3p></i></a> </div> </div> <div class="clouds" data-astro-cid-v2cbyr3p> ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-1", "data-astro-cid-v2cbyr3p": true })} ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-2", "data-astro-cid-v2cbyr3p": true })} ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-3", "data-astro-cid-v2cbyr3p": true })} </div> </section>  ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/components/About.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/sabido/my_portfolio/src/components/About.astro", void 0);

const $$Skills = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Skills;
  let skillsGroups = [
    {
      category: "Programming Languages",
      icon: "fa-solid fa-code",
      skills: ["JavaScript", "HTML5", "CSS3", "Java", "Python"]
    },
    {
      category: "Web Technologies",
      icon: "fa-solid fa-laptop-code",
      skills: ["React.js", "Astro", "Tailwind CSS", "Node.js", "Bootstrap"]
    },
    {
      category: "Tools & Databases",
      icon: "fa-solid fa-screwdriver-wrench",
      skills: ["Figma", "Git & GitHub", "MongoDB", "MySQL", "Canva"]
    }
  ];
  try {
    const { entries } = await getEmDashCollection("skills");
    if (entries && entries.length > 0) {
      const iconMap = {
        "Programming Languages": "fa-solid fa-code",
        "Web Technologies": "fa-solid fa-laptop-code",
        "Tools & Databases": "fa-solid fa-screwdriver-wrench"
      };
      skillsGroups = entries.map((entry) => {
        const category = entry.data.category;
        const skills_list = entry.data.skills_list;
        const skills = skills_list ? skills_list.split(",").map((s) => s.trim()) : [];
        const icon = iconMap[category] || "fa-solid fa-cube";
        return { category, icon, skills };
      });
    }
  } catch (e) {
    console.error("Error fetching skills from EmDash:", e);
  }
  return renderTemplate`${maybeRenderHead()}<section class="skills" id="skills" data-astro-cid-ab4ihpzs> <h2 class="heading" data-astro-cid-ab4ihpzs>My <span data-astro-cid-ab4ihpzs>Skills</span></h2> <div class="skills-container" data-astro-cid-ab4ihpzs> ${skillsGroups.map((group) => renderTemplate`<div class="skill-box" data-astro-cid-ab4ihpzs> <div class="skill-icon" data-astro-cid-ab4ihpzs> <i${addAttribute(group.icon, "class")} data-astro-cid-ab4ihpzs></i> </div> <h3 data-astro-cid-ab4ihpzs>${group.category}</h3> <div class="skill-list" data-astro-cid-ab4ihpzs> ${group.skills.map((skill) => renderTemplate`<span class="skill-pill" data-astro-cid-ab4ihpzs>${skill}</span>`)} </div> </div>`)} </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Skills.astro", void 0);

const $$Experience = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<section class="experience" id="experience" data-astro-cid-xpq65ryk> <h2 class="heading" data-astro-cid-xpq65ryk>Experience / <span data-astro-cid-xpq65ryk>OJT</span></h2> <div class="experience-container" data-astro-cid-xpq65ryk> <div class="experience-box" data-astro-cid-xpq65ryk> <div class="experience-icon" data-astro-cid-xpq65ryk> <i class="fa-solid fa-briefcase" data-astro-cid-xpq65ryk></i> </div> <h3 data-astro-cid-xpq65ryk>Web Development Internship</h3> <p data-astro-cid-xpq65ryk>Assisted in developing web applications and gained hands-on experience in software development. Worked with modern frameworks and collaborated with senior developers.</p> </div> <div class="experience-box" data-astro-cid-xpq65ryk> <div class="experience-icon" data-astro-cid-xpq65ryk> <i class="fa-solid fa-laptop-code" data-astro-cid-xpq65ryk></i> </div> <h3 data-astro-cid-xpq65ryk>Freelance Graphic Designer</h3> <p data-astro-cid-xpq65ryk>Created websites for small businesses and individuals, enhancing my skills in web design and development. Managed client relationships and delivered projects on time.</p> </div> </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Experience.astro", void 0);

const $$Projects = createComponent(async ($$result, $$props, $$slots) => {
  let projectsList = [
    {
      title: "Portfolio Website",
      description: "A responsive personal portfolio website built with HTML, CSS, and JavaScript showcasing my skills and projects.",
      icon: "fa-solid fa-laptop-code",
      tags: ["HTML", "CSS", "JavaScript"],
      project_url: "https://github.com/mykxttyjay/my_portfolio"
    },
    {
      title: "Mobile App Design",
      description: "UI/UX design for a mobile application focused on user experience and modern design principles.",
      icon: "fa-solid fa-mobile-screen",
      tags: ["UI/UX", "Figma", "Design"],
      project_url: ""
    },
    {
      title: "Web Application",
      description: "Full-stack web application with user authentication, data visualization, and real-time updates.",
      icon: "fa-solid fa-code",
      tags: ["React", "Node.js", "MongoDB"],
      project_url: ""
    }
  ];
  try {
    const { entries } = await getEmDashCollection("projects");
    if (entries && entries.length > 0) {
      projectsList = entries.map((entry) => {
        const title = entry.data.title;
        const description = entry.data.description;
        const icon = entry.data.icon;
        const tags_str = entry.data.tags;
        const tags = tags_str ? tags_str.split(",").map((t) => t.trim()) : [];
        const project_url = entry.data.project_url || "";
        return { title, description, icon, tags, project_url };
      });
    }
  } catch (e) {
    console.error("Error fetching projects from EmDash:", e);
  }
  return renderTemplate`${maybeRenderHead()}<section class="projects" id="projects" data-astro-cid-amng4zvp> <h2 class="heading" data-astro-cid-amng4zvp>My <span data-astro-cid-amng4zvp>Projects</span></h2> <div class="projects-container" data-astro-cid-amng4zvp> ${projectsList.map((project) => {
    const isLink = !!project.project_url;
    return isLink ? renderTemplate`<a${addAttribute(project.project_url, "href")} target="_blank" class="project-card link-card" data-astro-cid-amng4zvp> <div class="project-icon" data-astro-cid-amng4zvp> <i${addAttribute(project.icon, "class")} data-astro-cid-amng4zvp></i> </div> <h3 data-astro-cid-amng4zvp>${project.title}</h3> <p data-astro-cid-amng4zvp>${project.description}</p> <div class="project-tags" data-astro-cid-amng4zvp> ${project.tags.map((tag) => renderTemplate`<span class="tag" data-astro-cid-amng4zvp>${tag}</span>`)} </div> </a>` : renderTemplate`<div class="project-card" data-astro-cid-amng4zvp> <div class="project-icon" data-astro-cid-amng4zvp> <i${addAttribute(project.icon, "class")} data-astro-cid-amng4zvp></i> </div> <h3 data-astro-cid-amng4zvp>${project.title}</h3> <p data-astro-cid-amng4zvp>${project.description}</p> <div class="project-tags" data-astro-cid-amng4zvp> ${project.tags.map((tag) => renderTemplate`<span class="tag" data-astro-cid-amng4zvp>${tag}</span>`)} </div> </div>`;
  })} </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Projects.astro", void 0);

const $$Contact = createComponent(async ($$result, $$props, $$slots) => {
  let contactItems = [
    {
      platform: "Email",
      value: "sabidoangel.uc@gmail.com",
      icon: "fa-solid fa-envelope"
    },
    {
      platform: "Phone",
      value: "+63 954 291 7099",
      icon: "fa-solid fa-phone"
    },
    {
      platform: "Location",
      value: "Lapu-Lapu City, Cebu 6015, Philippines",
      icon: "fa-solid fa-location-dot"
    }
  ];
  try {
    const { entries } = await getEmDashCollection("contact");
    if (entries && entries.length > 0) {
      contactItems = entries.map((entry) => {
        const platform = entry.data.platform;
        const value = entry.data.value;
        const icon = entry.data.icon;
        return { platform, value, icon };
      });
    }
  } catch (e) {
    console.error("Error fetching contacts from EmDash:", e);
  }
  return renderTemplate`${maybeRenderHead()}<section class="contact" id="contact" data-astro-cid-xmivup5a> <h2 class="heading" data-astro-cid-xmivup5a>Contact <span data-astro-cid-xmivup5a>Me</span></h2> <div class="contact-container" data-astro-cid-xmivup5a> <div class="contact-info" data-astro-cid-xmivup5a> ${contactItems.map((item) => renderTemplate`<div class="info-box" data-astro-cid-xmivup5a> <div class="info-icon" data-astro-cid-xmivup5a> <i${addAttribute(item.icon, "class")} data-astro-cid-xmivup5a></i> </div> <div data-astro-cid-xmivup5a> <h3 data-astro-cid-xmivup5a>${item.platform}</h3> <p data-astro-cid-xmivup5a>${item.value}</p> </div> </div>`)} </div> <form action="#" class="contact-form" data-astro-cid-xmivup5a> <div class="form-group" data-astro-cid-xmivup5a> <input type="text" placeholder="Your Name" required data-astro-cid-xmivup5a> <i class="fa-solid fa-user" data-astro-cid-xmivup5a></i> </div> <div class="form-group" data-astro-cid-xmivup5a> <input type="email" placeholder="Your Email" required data-astro-cid-xmivup5a> <i class="fa-solid fa-envelope" data-astro-cid-xmivup5a></i> </div> <div class="form-group" data-astro-cid-xmivup5a> <input type="text" placeholder="Subject" required data-astro-cid-xmivup5a> <i class="fa-solid fa-pen" data-astro-cid-xmivup5a></i> </div> <div class="form-group" data-astro-cid-xmivup5a> <textarea placeholder="Your Message" required data-astro-cid-xmivup5a></textarea> <i class="fa-solid fa-message" data-astro-cid-xmivup5a></i> </div> <button type="submit" class="btn" data-astro-cid-xmivup5a> <span data-astro-cid-xmivup5a>Send Message</span> <i class="fa-solid fa-paper-plane" data-astro-cid-xmivup5a></i> </button> </form> </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Contact.astro", void 0);

const $$Index = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Index;
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><meta name="viewport" content="width=device-width"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>My Portfolio</title>${renderHead()}</head> <body> ${renderComponent($$result, "Home", $$Home, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "light-to-dark" })} ${renderComponent($$result, "About", $$About, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "dark-to-light" })} ${renderComponent($$result, "Skills", $$Skills, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "light-to-dark" })} ${renderComponent($$result, "Projects", $$Projects, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "dark-to-light" })} ${renderComponent($$result, "Experience", $$Experience, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "light-to-dark" })} ${renderComponent($$result, "Contact", $$Contact, {})} ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/pages/index.astro?astro&type=script&index=0&lang.ts")} </body> </html>`;
}, "C:/Users/sabido/my_portfolio/src/pages/index.astro", void 0);

const $$file = "C:/Users/sabido/my_portfolio/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
