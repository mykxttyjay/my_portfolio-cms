import { c as createComponent } from './astro-component_wp9zoKZU.mjs';
import 'piccolore';
import { T as createRenderInstruction, aw as generateCspDigest, bf as unescapeHTML, Q as renderTemplate, z as maybeRenderHead, a3 as addAttribute, b0 as renderHead } from './params-and-props_DwyEVPUa.mjs';
import { s as spreadAttributes, r as renderComponent } from './entrypoint_D95vxwaV.mjs';
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
  let name = "Angel Marie Sabido";
  let role = "IT Student";
  let intro = "Aspiring IT professional with a strong work ethic and a passion for learning and growth in the technology field. Committed to developing technical skills and contributing positively to team environments. Eager to gain hands-on experience and continuously improve to deliver quality results in any task or project.";
  let aboutContent = "Driven by curiosity and a desire to make an impact, I aim to leverage my skills to support organizational goals, create innovative digital solutions, and grow as a well-rounded IT professional.";
  let resumeLink = "https://linkedin.com/in/gelmarie";
  try {
    const { entries } = await getEmDashCollection("profile");
    if (entries && entries.length > 0 && entries[0].data) {
      name = entries[0].data.name || name;
      role = entries[0].data.role || role;
      intro = entries[0].data.intro || intro;
      aboutContent = entries[0].data.about_content || aboutContent;
      resumeLink = entries[0].data.resume_link || resumeLink;
    }
  } catch (e) {
    console.error("Error fetching profile from EmDash:", e);
  }
  return renderTemplate`${maybeRenderHead()}<section class="home" id="home" data-astro-cid-xhaoqxbd> <div class="home-img" data-astro-cid-xhaoqxbd> <div class="rotating-border" data-astro-cid-xhaoqxbd></div> <div class="rotating-border-2" data-astro-cid-xhaoqxbd></div> <img src="main.jpg"${addAttribute(name, "alt")} data-astro-cid-xhaoqxbd> <div class="img-glow" data-astro-cid-xhaoqxbd></div> </div> <div class="home-content" data-astro-cid-xhaoqxbd> <h1 class="fade-in" data-astro-cid-xhaoqxbd>Hi, I'm <span class="gradient-text" data-astro-cid-xhaoqxbd>${name}</span></h1> <h3 class="typing-text fade-in-delay-1" data-astro-cid-xhaoqxbd>I'm a <span data-astro-cid-xhaoqxbd></span></h3> <p class="fade-in-delay-2" data-astro-cid-xhaoqxbd>${intro}</p> <br data-astro-cid-xhaoqxbd> <p class="fade-in-delay-2" data-astro-cid-xhaoqxbd>${aboutContent}</p> <div class="btn-group fade-in-delay-3" data-astro-cid-xhaoqxbd> <a href="#contact" class="btn" data-astro-cid-xhaoqxbd>Contact Me</a> <a href="#projects" class="btn btn-secondary" data-astro-cid-xhaoqxbd>View Projects</a> <a${addAttribute(resumeLink, "href")} target="_blank" class="btn btn-secondary" data-astro-cid-xhaoqxbd><i class="fa-solid fa-download" data-astro-cid-xhaoqxbd></i> Download CV</a> </div> <div class="social-icons fade-in-delay-4" data-astro-cid-xhaoqxbd> <a href="https://www.linkedin.com/in/gelmarie" target="_blank" title="LinkedIn" data-astro-cid-xhaoqxbd><i class="fa-brands fa-linkedin" data-astro-cid-xhaoqxbd></i></a> <a href="https://github.com/mykxttyjay" target="_blank" title="GitHub" data-astro-cid-xhaoqxbd><i class="fa-brands fa-github" data-astro-cid-xhaoqxbd></i></a> <a href="https://twitter.com/mykxttyjay" target="_blank" title="Twitter" data-astro-cid-xhaoqxbd><i class="fa-brands fa-x-twitter" data-astro-cid-xhaoqxbd></i></a> <a href="https://www.instagram.com/gelmarieee" target="_blank" title="Instagram" data-astro-cid-xhaoqxbd><i class="fa-brands fa-instagram" data-astro-cid-xhaoqxbd></i></a> </div> </div> <div class="clouds" data-astro-cid-xhaoqxbd> ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-1", "data-astro-cid-xhaoqxbd": true })} ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-2", "data-astro-cid-xhaoqxbd": true })} ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-3", "data-astro-cid-xhaoqxbd": true })} </div> </section>  ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/components/Home.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/sabido/my_portfolio/src/components/Home.astro", void 0);

const $$Divider = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Divider;
  const { type = "light-to-dark" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div${addAttribute(`divider w-full leading-[0] m-0 p-0 relative z-[5] ${type === "light-to-dark" ? "bg-light" : "bg-primary"}`, "class")}> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100" preserveAspectRatio="none" class="block w-full h-20 -mt-px -mb-px"> <path d="M0,50 Q80,20 160,50 T320,50 T480,50 T640,50 T800,50 T960,50 T1120,50 T1280,50 T1440,50 L1440,100 L0,100 Z"${addAttribute(`divider-path ${type === "light-to-dark" ? "fill-primary" : "fill-light"}`, "class")}></path> </svg> </div>`;
}, "C:/Users/sabido/my_portfolio/src/components/Divider.astro", void 0);

const $$About = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<section class="about" id="about" data-astro-cid-v2cbyr3p> <h2 class="heading" data-astro-cid-v2cbyr3p>Educational <span data-astro-cid-v2cbyr3p>Background</span></h2> <div class="timeline" data-astro-cid-v2cbyr3p> <div class="timeline-item" data-astro-cid-v2cbyr3p> <div class="timeline-dot" data-astro-cid-v2cbyr3p></div> <div class="timeline-date" data-astro-cid-v2cbyr3p>Batch 2026</div> <div class="timeline-content" data-astro-cid-v2cbyr3p> <div class="timeline-connector" data-astro-cid-v2cbyr3p></div> <h3 data-astro-cid-v2cbyr3p>Bachelor of Science in Information Technology</h3> <h4 data-astro-cid-v2cbyr3p>University of Cebu - Lapu-Lapu and Mandaue</h4> <p data-astro-cid-v2cbyr3p>Dean's Lister from 1st Year to 3rd Year</p> <div class="achievement-badge" data-astro-cid-v2cbyr3p> <i class="fa-solid fa-award" data-astro-cid-v2cbyr3p></i> <span data-astro-cid-v2cbyr3p>Dean's Lister</span> </div> <div class="achievement-badge" data-astro-cid-v2cbyr3p> <i class="fa-solid fa-graduation-cap" data-astro-cid-v2cbyr3p></i> <span data-astro-cid-v2cbyr3p>Academic Scholar</span> </div> </div> </div> <div class="timeline-item" data-astro-cid-v2cbyr3p> <div class="timeline-dot" data-astro-cid-v2cbyr3p></div> <div class="timeline-date" data-astro-cid-v2cbyr3p>Batch 2022</div> <div class="timeline-content" data-astro-cid-v2cbyr3p> <div class="timeline-connector" data-astro-cid-v2cbyr3p></div> <h3 data-astro-cid-v2cbyr3p>Senior High School</h3> <h4 data-astro-cid-v2cbyr3p>University of Cebu - Lapu-Lapu and Mandaue</h4> <p data-astro-cid-v2cbyr3p>Science, Technology, Engineering, and Mathematics (STEM)</p> <div class="achievement-badge" data-astro-cid-v2cbyr3p> <i class="fa-solid fa-medal" data-astro-cid-v2cbyr3p></i> <span data-astro-cid-v2cbyr3p>With Honors</span> </div> <div class="achievement-badge" data-astro-cid-v2cbyr3p> <i class="fa-solid fa-graduation-cap" data-astro-cid-v2cbyr3p></i> <span data-astro-cid-v2cbyr3p>Academic Scholar</span> </div> </div> </div> <div class="timeline-item" data-astro-cid-v2cbyr3p> <div class="timeline-dot" data-astro-cid-v2cbyr3p></div> <div class="timeline-date" data-astro-cid-v2cbyr3p>Class of 2020</div> <div class="timeline-content" data-astro-cid-v2cbyr3p> <h3 data-astro-cid-v2cbyr3p>Junior High School</h3> <h4 data-astro-cid-v2cbyr3p>Babag National High School</h4> <p data-astro-cid-v2cbyr3p>Graduated with Honors</p> <div class="achievement-badge" data-astro-cid-v2cbyr3p> <i class="fa-solid fa-medal" data-astro-cid-v2cbyr3p></i> <span data-astro-cid-v2cbyr3p>With Honors</span> </div> </div> </div> <div class="timeline-item" data-astro-cid-v2cbyr3p> <div class="timeline-dot" data-astro-cid-v2cbyr3p></div> <div class="timeline-date" data-astro-cid-v2cbyr3p>Class of 2016</div> <div class="timeline-content" data-astro-cid-v2cbyr3p> <h3 data-astro-cid-v2cbyr3p>Elementary</h3> <h4 data-astro-cid-v2cbyr3p>Babag Elementary School</h4> <p data-astro-cid-v2cbyr3p>Completed primary education</p> </div> </div> </div> </section>`;
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
  return renderTemplate`${maybeRenderHead()}<section class="skills bg-light py-20" id="skills" data-astro-cid-ab4ihpzs> <h2 class="heading text-4xl font-bold mb-12 text-center text-dark" data-astro-cid-ab4ihpzs>
My <span class="gradient-text" data-astro-cid-ab4ihpzs>Skills</span> </h2> <div class="skills-container grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-10 max-w-[1100px] mx-auto px-8" data-astro-cid-ab4ihpzs> ${skillsGroups.map((group) => renderTemplate`<div class="skill-box bg-white border border-primary/5 p-10 px-8 rounded-3xl shadow-[0_10px_30px_rgba(162,136,166,0.06)] transition-all duration-[400ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] text-center flex flex-col items-center hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(162,136,166,0.12)] hover:border-primary/15" data-astro-cid-ab4ihpzs> <div class="skill-icon w-[60px] h-[60px] bg-light rounded-[20px] flex items-center justify-center text-primary text-2xl mb-6 shadow-[0_5px_15px_rgba(162,136,166,0.08)] border border-primary/10 transition-all duration-300 group-hover:scale-110 group-hover:rotate-[5deg] group-hover:rounded-full group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-secondary group-hover:text-white group-hover:border-transparent" data-astro-cid-ab4ihpzs> <i${addAttribute(group.icon, "class")} data-astro-cid-ab4ihpzs></i> </div> <h3 class="text-[1.4rem] text-dark mb-6 font-bold tracking-wide" data-astro-cid-ab4ihpzs>${group.category}</h3> <div class="skill-list flex flex-wrap gap-2.5 justify-center w-full" data-astro-cid-ab4ihpzs> ${group.skills.map((skill) => renderTemplate`<span class="skill-pill bg-light border border-primary/15 px-4 py-2 rounded-full text-[0.85rem] font-semibold text-primary transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] cursor-default hover:bg-gradient-to-br hover:from-primary hover:to-secondary hover:text-white hover:-translate-y-0.5 hover:scale-105 hover:shadow-[0_8px_20px_rgba(162,136,166,0.2)] hover:border-transparent" data-astro-cid-ab4ihpzs>${skill}</span>`)} </div> </div>`)} </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Skills.astro", void 0);

const $$Experience = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<section class="experience bg-light py-20" id="experience" data-astro-cid-xpq65ryk> <h2 class="heading text-4xl font-bold mb-12 text-center text-dark" data-astro-cid-xpq65ryk>
Experience / <span class="gradient-text" data-astro-cid-xpq65ryk>OJT</span> </h2> <div class="experience-container grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-10 max-w-[1000px] mx-auto px-8" data-astro-cid-xpq65ryk> <div class="experience-box bg-white p-10 px-8 rounded-3xl shadow-[0_10px_30px_rgba(162,136,166,0.06)] border border-primary/5 transition-all duration-[400ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] flex flex-col items-start hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(162,136,166,0.12)] hover:border-primary/15" data-astro-cid-xpq65ryk> <div class="experience-icon w-[60px] h-[60px] bg-gradient-to-br from-primary to-secondary rounded-[20px] flex items-center justify-center text-white text-2xl mb-6 shadow-[0_8px_20px_rgba(162,136,166,0.2)] transition-all duration-300 group-hover:scale-110 group-hover:rotate-[8deg] group-hover:rounded-full" data-astro-cid-xpq65ryk> <i class="fa-solid fa-briefcase" data-astro-cid-xpq65ryk></i> </div> <h3 class="text-[1.4rem] text-dark mb-4 font-bold" data-astro-cid-xpq65ryk>Web Development Internship</h3> <p class="text-[#555] leading-relaxed text-[0.95rem]" data-astro-cid-xpq65ryk>Assisted in developing web applications and gained hands-on experience in software development. Worked with modern frameworks and collaborated with senior developers.</p> </div> <div class="experience-box bg-white p-10 px-8 rounded-3xl shadow-[0_10px_30px_rgba(162,136,166,0.06)] border border-primary/5 transition-all duration-[400ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] flex flex-col items-start hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(162,136,166,0.12)] hover:border-primary/15" data-astro-cid-xpq65ryk> <div class="experience-icon w-[60px] h-[60px] bg-gradient-to-br from-primary to-secondary rounded-[20px] flex items-center justify-center text-white text-2xl mb-6 shadow-[0_8px_20px_rgba(162,136,166,0.2)] transition-all duration-300 group-hover:scale-110 group-hover:rotate-[8deg] group-hover:rounded-full" data-astro-cid-xpq65ryk> <i class="fa-solid fa-laptop-code" data-astro-cid-xpq65ryk></i> </div> <h3 class="text-[1.4rem] text-dark mb-4 font-bold" data-astro-cid-xpq65ryk>Freelance Graphic Designer</h3> <p class="text-[#555] leading-relaxed text-[0.95rem]" data-astro-cid-xpq65ryk>Created websites for small businesses and individuals, enhancing my skills in web design and development. Managed client relationships and delivered projects on time.</p> </div> </div> </section>`;
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
        const title = entry.data?.title || "";
        const description = entry.data?.description || "";
        const icon = entry.data?.icon || "";
        const tags_str = entry.data?.tags || "";
        const tags = tags_str ? tags_str.split(",").map((t) => t.trim()) : [];
        const project_url = entry.data?.project_url || "";
        return { title, description, icon, tags, project_url };
      });
    }
  } catch (e) {
    console.error("Error fetching projects from EmDash:", e);
  }
  return renderTemplate`${maybeRenderHead()}<section class="projects bg-primary py-20" id="projects" data-astro-cid-amng4zvp> <h2 class="heading text-4xl font-bold mb-12 text-center text-white" data-astro-cid-amng4zvp>
My <span class="gradient-text-accent" data-astro-cid-amng4zvp>Projects</span> </h2> <div class="projects-container grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-10 max-w-[1200px] mx-auto px-8" data-astro-cid-amng4zvp> ${projectsList.map((project) => {
    const isLink = !!project.project_url;
    const CardTag = isLink ? "a" : "div";
    return renderTemplate`${renderComponent($$result, "CardTag", CardTag, { "href": isLink ? project.project_url : void 0, "target": isLink ? "_blank" : void 0, "class": "project-card bg-white/8 backdrop-blur-xl border border-white/15 p-10 px-8 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-[400ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] flex flex-col items-start no-underline hover:-translate-y-2 hover:shadow-[0_25px_50px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.1)_inset] hover:border-white/30", "data-astro-cid-amng4zvp": true }, { "default": async ($$result2) => renderTemplate` <div class="project-icon w-[60px] h-[60px] bg-white/15 rounded-[20px] flex items-center justify-center text-white text-2xl mb-6 border border-white/20 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-[8deg] group-hover:rounded-full group-hover:bg-white group-hover:text-primary" data-astro-cid-amng4zvp> <i${addAttribute(project.icon, "class")} data-astro-cid-amng4zvp></i> </div> <h3 class="text-[1.45rem] text-white mb-4 font-bold" data-astro-cid-amng4zvp>${project.title}</h3> <p class="text-white/85 leading-relaxed mb-6 text-[0.95rem]" data-astro-cid-amng4zvp>${project.description}</p> <div class="project-tags flex gap-2 flex-wrap mt-auto" data-astro-cid-amng4zvp> ${project.tags.map((tag) => renderTemplate`<span class="tag px-3.5 py-1.5 bg-white/10 border border-white/15 rounded-full text-[0.8rem] font-semibold text-white transition-all duration-300 cursor-default hover:bg-white hover:text-primary hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(0,0,0,0.1)]" data-astro-cid-amng4zvp>${tag}</span>`)} </div> ` })}`;
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
        const platform = entry.data?.platform || "";
        const value = entry.data?.value || "";
        const icon = entry.data?.icon || "";
        return { platform, value, icon };
      });
    }
  } catch (e) {
    console.error("Error fetching contacts from EmDash:", e);
  }
  return renderTemplate`${maybeRenderHead()}<section class="contact bg-primary py-20" id="contact" data-astro-cid-xmivup5a> <h2 class="heading text-4xl font-bold mb-12 text-center text-white" data-astro-cid-xmivup5a>
Contact <span class="gradient-text-accent" data-astro-cid-xmivup5a>Me</span> </h2> <div class="contact-container grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-12 max-w-[1200px] mx-auto px-8" data-astro-cid-xmivup5a> <div class="contact-info flex flex-col gap-6" data-astro-cid-xmivup5a> ${contactItems.map((item) => renderTemplate`<div class="info-box bg-white/8 backdrop-blur-xl border border-white/15 p-6 px-7 rounded-[20px] flex items-center gap-5 shadow-[0_15px_35px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:-translate-y-1 hover:shadow-[0_25px_50px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.1)_inset] hover:border-white/25" data-astro-cid-xmivup5a> <div class="info-icon w-[50px] h-[50px] bg-white/15 border border-white/20 rounded-[15px] flex items-center justify-center text-white text-xl flex-shrink-0 shadow-[0_5px_15px_rgba(0,0,0,0.05)] transition-all duration-300 group-hover:scale-110 group-hover:rotate-[10deg] group-hover:rounded-full group-hover:bg-white group-hover:text-primary group-hover:border-transparent" data-astro-cid-xmivup5a> <i${addAttribute(item.icon, "class")} data-astro-cid-xmivup5a></i> </div> <div data-astro-cid-xmivup5a> <h3 class="text-lg text-white mb-1 font-bold" data-astro-cid-xmivup5a>${item.platform}</h3> <p class="text-white/85 text-[0.95rem] font-medium" data-astro-cid-xmivup5a>${item.value}</p> </div> </div>`)} </div> <form action="#" class="contact-form flex flex-col gap-6" data-astro-cid-xmivup5a> <div class="form-group relative" data-astro-cid-xmivup5a> <input type="text" placeholder="Your Name" required class="w-full py-4 px-4 pl-[3.2rem] border-2 border-white/15 rounded-[15px] text-base font-[inherit] transition-all duration-300 bg-white/8 text-white shadow-[0_2px_5px_rgba(0,0,0,0.02)] placeholder:text-white/60 focus:outline-none focus:border-white focus:bg-white/12 focus:shadow-[0_8px_25px_rgba(255,255,255,0.15)]" data-astro-cid-xmivup5a> <i class="fa-solid fa-user absolute left-5 top-5 text-white/70 text-lg transition-all duration-300" data-astro-cid-xmivup5a></i> </div> <div class="form-group relative" data-astro-cid-xmivup5a> <input type="email" placeholder="Your Email" required class="w-full py-4 px-4 pl-[3.2rem] border-2 border-white/15 rounded-[15px] text-base font-[inherit] transition-all duration-300 bg-white/8 text-white shadow-[0_2px_5px_rgba(0,0,0,0.02)] placeholder:text-white/60 focus:outline-none focus:border-white focus:bg-white/12 focus:shadow-[0_8px_25px_rgba(255,255,255,0.15)]" data-astro-cid-xmivup5a> <i class="fa-solid fa-envelope absolute left-5 top-5 text-white/70 text-lg transition-all duration-300" data-astro-cid-xmivup5a></i> </div> <div class="form-group relative" data-astro-cid-xmivup5a> <input type="text" placeholder="Subject" required class="w-full py-4 px-4 pl-[3.2rem] border-2 border-white/15 rounded-[15px] text-base font-[inherit] transition-all duration-300 bg-white/8 text-white shadow-[0_2px_5px_rgba(0,0,0,0.02)] placeholder:text-white/60 focus:outline-none focus:border-white focus:bg-white/12 focus:shadow-[0_8px_25px_rgba(255,255,255,0.15)]" data-astro-cid-xmivup5a> <i class="fa-solid fa-pen absolute left-5 top-5 text-white/70 text-lg transition-all duration-300" data-astro-cid-xmivup5a></i> </div> <div class="form-group relative" data-astro-cid-xmivup5a> <textarea placeholder="Your Message" required class="w-full py-4 px-4 pl-[3.2rem] border-2 border-white/15 rounded-[15px] text-base font-[inherit] transition-all duration-300 bg-white/8 text-white shadow-[0_2px_5px_rgba(0,0,0,0.02)] placeholder:text-white/60 focus:outline-none focus:border-white focus:bg-white/12 focus:shadow-[0_8px_25px_rgba(255,255,255,0.15)] min-h-[150px] resize-y" data-astro-cid-xmivup5a></textarea> <i class="fa-solid fa-message absolute left-5 top-5 text-white/70 text-lg transition-all duration-300" data-astro-cid-xmivup5a></i> </div> <button type="submit" class="btn flex items-center justify-center gap-2.5 w-fit py-4 px-9 rounded-full transition-all duration-300 bg-white text-primary shadow-[0_10px_25px_rgba(0,0,0,0.1)] border-none cursor-pointer hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.2)] hover:bg-light" data-astro-cid-xmivup5a> <span data-astro-cid-xmivup5a>Send Message</span> <i class="fa-solid fa-paper-plane transition-transform duration-300" data-astro-cid-xmivup5a></i> </button> </form> </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Contact.astro", void 0);

const $$Index = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Index;
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><meta name="viewport" content="width=device-width"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>My Portfolio</title>${renderHead()}</head> <body class="font-sans leading-normal text-dark bg-light bg-[radial-gradient(circle_at_20%_50%,rgba(162,136,166,0.1)_0%,transparent_50%),radial-gradient(circle_at_80%_80%,rgba(187,155,176,0.1)_0%,transparent_50%),radial-gradient(circle_at_40%_20%,rgba(204,188,188,0.08)_0%,transparent_50%),linear-gradient(135deg,#f1e3e4_0%,rgba(241,227,228,0.8)_100%)] bg-fixed relative"> ${renderComponent($$result, "Home", $$Home, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "light-to-dark" })} ${renderComponent($$result, "About", $$About, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "dark-to-light" })} ${renderComponent($$result, "Skills", $$Skills, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "light-to-dark" })} ${renderComponent($$result, "Projects", $$Projects, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "dark-to-light" })} ${renderComponent($$result, "Experience", $$Experience, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "light-to-dark" })} ${renderComponent($$result, "Contact", $$Contact, {})} ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/pages/index.astro?astro&type=script&index=0&lang.ts")} </body> </html>`;
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
