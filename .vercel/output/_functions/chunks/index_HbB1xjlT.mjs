import { c as createComponent } from './astro-component_DWgf7HYh.mjs';
import 'piccolore';
import { q as createRenderInstruction, m as maybeRenderHead, r as renderTemplate, n as addAttribute, v as generateCspDigest, s as spreadAttributes, u as unescapeHTML, w as renderComponent, x as renderHead } from './entrypoint_GT00VIuN.mjs';
import 'clsx';

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

async function safeGetEmDashCollection(collectionName) {
  try {
    const { getEmDashCollection } = await import('./index_YDCxyZCT.mjs').then(n => n.i);
    const result = await getEmDashCollection(collectionName);
    return result;
  } catch (e) {
    console.warn(`EmDash collection '${collectionName}' not available, using fallback data:`, e);
    return { entries: [] };
  }
}

const $$Home = createComponent(async ($$result, $$props, $$slots) => {
  let name = "Angel";
  let role = "A Designer & Developer";
  let intro = "Welcome to my portfolio! I'm excited to share my journey, projects, and passion for technology with you. Let's explore what we can build together.";
  const { entries } = await safeGetEmDashCollection("profile");
  if (entries && entries.length > 0 && entries[0].data) {
    name = entries[0].data.name || name;
    intro = entries[0].data.intro || intro;
  }
  return renderTemplate`${maybeRenderHead()}<section class="home" id="home" data-astro-cid-xhaoqxbd> <!-- Background Crumpled Texture & Vignette Overlay --> <div class="crumpled-overlay" data-astro-cid-xhaoqxbd></div> <!-- Minimal floating sparkling diamonds --> <div class="sparkles-container" data-astro-cid-xhaoqxbd> <div class="sparkle sparkle-1" data-astro-cid-xhaoqxbd> <svg viewBox="0 0 24 24" data-astro-cid-xhaoqxbd><path d="M12,2 L15,9 L22,12 L15,15 L12,22 L9,15 L2,12 L9,9 Z" data-astro-cid-xhaoqxbd></path></svg> </div> <div class="sparkle sparkle-2" data-astro-cid-xhaoqxbd> <svg viewBox="0 0 24 24" data-astro-cid-xhaoqxbd><path d="M12,2 L14,10 L22,12 L14,14 L12,22 L10,14 L2,12 L10,10 Z" data-astro-cid-xhaoqxbd></path></svg> </div> <div class="sparkle sparkle-3" data-astro-cid-xhaoqxbd> <svg viewBox="0 0 24 24" data-astro-cid-xhaoqxbd><path d="M12,2 L15,9 L22,12 L15,15 L12,22 L9,15 L2,12 L9,9 Z" data-astro-cid-xhaoqxbd></path></svg> </div> <div class="sparkle sparkle-4" data-astro-cid-xhaoqxbd> <svg viewBox="0 0 24 24" data-astro-cid-xhaoqxbd><path d="M12,2 L14,10 L22,12 L14,14 L12,22 L10,14 L2,12 L10,10 Z" data-astro-cid-xhaoqxbd></path></svg> </div> <div class="sparkle sparkle-5" data-astro-cid-xhaoqxbd> <svg viewBox="0 0 24 24" data-astro-cid-xhaoqxbd><path d="M12,2 L15,9 L22,12 L15,15 L12,22 L9,15 L2,12 L9,9 Z" data-astro-cid-xhaoqxbd></path></svg> </div> <div class="sparkle sparkle-6" data-astro-cid-xhaoqxbd> <svg viewBox="0 0 24 24" data-astro-cid-xhaoqxbd><path d="M12,2 L14,10 L22,12 L14,14 L12,22 L10,14 L2,12 L10,10 Z" data-astro-cid-xhaoqxbd></path></svg> </div> </div> <!-- Centered envelope with letter inside --> <div class="envelope-container" data-astro-cid-xhaoqxbd> <!-- 1. Envelope Back Flap (behind the letter) --> <div class="envelope-back" data-astro-cid-xhaoqxbd> <svg viewBox="0 0 650 400" preserveAspectRatio="none" data-astro-cid-xhaoqxbd> <!-- Triangular open flap pointing up, slightly darker cream for depth shadow --> <path d="M 5,395 L 5,180 L 325,5 L 645,180 L 645,395 Z" fill="#EADFCB" stroke="#4A1215" stroke-width="4.5" stroke-linejoin="round" data-astro-cid-xhaoqxbd></path> </svg> </div> <!-- 2. Letter paper wrapper (clips bottom) --> <div class="letter-wrapper" data-astro-cid-xhaoqxbd> <div class="letter-paper" data-astro-cid-xhaoqxbd> <!-- Notebook Perforated Top Edge --> <div class="notebook-top" data-astro-cid-xhaoqxbd> <svg class="notebook-tear-svg" viewBox="0 0 600 35" preserveAspectRatio="none" data-astro-cid-xhaoqxbd> <!-- Punched spiral binding holes (filled with background red to look cut-out) --> <g fill="#8F1D21" stroke="#4A1215" stroke-width="2.5" data-astro-cid-xhaoqxbd> <circle cx="30" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="60" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="90" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="120" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="150" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="180" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="210" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="240" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="270" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="300" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="330" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="360" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="390" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="420" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="450" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="480" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="510" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="540" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> <circle cx="570" cy="12" r="6" data-astro-cid-xhaoqxbd></circle> </g> <!-- Dotted tear line below holes --> <line x1="15" y1="28" x2="585" y2="28" stroke="#4A1215" stroke-width="2.5" stroke-dasharray="5,6" stroke-linecap="round" data-astro-cid-xhaoqxbd></line> </svg> </div> <!-- Letter Contents --> <div class="letter-content" data-astro-cid-xhaoqxbd> <h1 class="letter-title" data-astro-cid-xhaoqxbd>Hello, I'm ${name}</h1> <div class="letter-role-capsule" data-astro-cid-xhaoqxbd>${role}</div> <p class="letter-description" data-astro-cid-xhaoqxbd>${intro}</p> </div> </div> </div> <!-- 3. Envelope Front Body pocket (Covers bottom of letter) --> <div class="envelope-body" data-astro-cid-xhaoqxbd> <svg class="envelope-front-svg" viewBox="0 0 650 220" preserveAspectRatio="none" data-astro-cid-xhaoqxbd> <!-- Outer pocket fold (covers the letter bottom) --> <path d="M 5,215 L 5,5 L 325,120 L 645,5 L 645,215 Z" fill="#FCF8F2" stroke="#4A1215" stroke-width="4.5" stroke-linejoin="round" data-astro-cid-xhaoqxbd></path> <!-- Crease lines meeting in the center seal --> <path d="M 5,215 L 325,120" stroke="#4A1215" stroke-width="4" stroke-linecap="round" data-astro-cid-xhaoqxbd></path> <path d="M 645,215 L 325,120" stroke="#4A1215" stroke-width="4" stroke-linecap="round" data-astro-cid-xhaoqxbd></path> </svg> <!-- 4. Wax Seal in the center of folds (Mathematically locked to intersection) --> <div class="wax-seal" data-astro-cid-xhaoqxbd> <svg viewBox="0 0 120 120" class="wax-seal-svg" data-astro-cid-xhaoqxbd> <!-- Melted organic outer wax circle --> <path d="M 60,6 C 92,3 116,21 114,56 C 112,88 95,116 63,114 C 29,112 4,93 6,57 C 8,23 28,9 60,6 Z" fill="#8F1D21" stroke="#4A1215" stroke-width="4.5" stroke-linejoin="round" data-astro-cid-xhaoqxbd></path> <!-- Stamped inner ridge --> <circle cx="60" cy="60" r="41" fill="#A12227" stroke="#4A1215" stroke-width="3" data-astro-cid-xhaoqxbd></circle> <!-- Glossy reflection --> <path d="M 33,33 A 28,28 0 0 1 87,33" fill="none" stroke="rgba(255, 255, 255, 0.2)" stroke-width="4.5" stroke-linecap="round" data-astro-cid-xhaoqxbd></path> <!-- Embossed Star in center --> <polygon points="60,36 66,50 81,50 69,60 74,75 60,66 46,75 51,60 39,50 54,50" fill="#5A0E11" stroke="#4A1215" stroke-width="3" stroke-linejoin="round" data-astro-cid-xhaoqxbd></polygon> </svg> </div> </div> </div> </section> ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/components/Home.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/sabido/my_portfolio/src/components/Home.astro", void 0);

const $$Divider = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Divider;
  const { type = "light-to-dark", class: className } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div${addAttribute(`divider ${type} ${className || ""}`, "class")} data-astro-cid-e4yecxcx> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100" preserveAspectRatio="none" data-astro-cid-e4yecxcx> <path d="M0,30 L20,35 L35,28 L55,40 L70,32 L90,38 L110,25 L130,35 L145,28 L165,40 L185,30 L200,38 L220,32 L240,40 L255,28 L275,35 L295,30 L310,38 L330,32 L350,40 L365,28 L385,35 L405,30 L420,38 L440,32 L460,40 L475,28 L495,35 L515,30 L530,38 L550,32 L570,40 L585,28 L605,35 L625,30 L640,38 L660,32 L680,40 L695,28 L715,35 L735,30 L750,38 L770,32 L790,40 L805,28 L825,35 L845,30 L860,38 L880,32 L900,40 L915,28 L935,35 L955,30 L970,38 L990,32 L1010,40 L1025,28 L1045,35 L1065,30 L1080,38 L1100,32 L1120,40 L1135,28 L1155,35 L1175,30 L1190,38 L1210,32 L1230,40 L1245,28 L1265,35 L1285,30 L1300,38 L1320,32 L1340,40 L1355,28 L1375,35 L1395,30 L1410,38 L1430,32 L1440,35 L1440,100 L0,100 Z" class="divider-path" data-astro-cid-e4yecxcx></path> </svg> </div>`;
}, "C:/Users/sabido/my_portfolio/src/components/Divider.astro", void 0);

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

const $$About = createComponent(async ($$result, $$props, $$slots) => {
  let name = "Angel Marie Sabido";
  let intro = "Hello! I am an aspiring IT professional with a strong work ethic and a deep passion for creating user-friendly digital solutions. Throughout my academic journey, I have built a solid foundation in web development, database management, and designing impactful technology that solves real-world problems.";
  let resumeLink = "https://linkedin.com/in/gelmarie";
  const { entries } = await safeGetEmDashCollection("profile");
  if (entries && entries.length > 0 && entries[0].data) {
    name = entries[0].data.name || name;
    intro = entries[0].data.intro || intro;
    resumeLink = entries[0].data.resume_link || resumeLink;
  }
  (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return renderTemplate`${maybeRenderHead()}<section class="about" id="about" data-astro-cid-v2cbyr3p> <div class="about-container" data-astro-cid-v2cbyr3p> <!-- Paperclip SVG on top left of the layout to tie it into a physical scrapbook desk --> <div class="paperclip" data-astro-cid-v2cbyr3p> <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" data-astro-cid-v2cbyr3p> <path d="M40 90 L40 30 A15 15 0 0 1 70 30 L70 70 A10 10 0 0 1 50 70 L50 40 A5 5 0 0 1 60 40 L60 65" stroke="#D4AF37" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-v2cbyr3p></path> </svg> </div> <div class="about-card-wrapper" data-astro-cid-v2cbyr3p> <div class="about-card" data-astro-cid-v2cbyr3p> <div class="card-image" data-astro-cid-v2cbyr3p> <img src="https://images.unsplash.com/photo-1567484072688-2041f76a3fda?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Angel Marie Sabido" data-astro-cid-v2cbyr3p> </div> <div class="card-content" data-astro-cid-v2cbyr3p> <h3 class="card-name" data-astro-cid-v2cbyr3p>Hi! It's ${name}</h3> <div class="card-info-grid" data-astro-cid-v2cbyr3p> <div class="info-pill" data-astro-cid-v2cbyr3p> <div class="info-icon" data-astro-cid-v2cbyr3p><i class="fa-regular fa-calendar-days" data-astro-cid-v2cbyr3p></i></div> <div class="info-details" data-astro-cid-v2cbyr3p> <span class="info-label" data-astro-cid-v2cbyr3p>Birthday</span> <span class="info-value" data-astro-cid-v2cbyr3p>September 30, 2003</span> </div> </div> <div class="info-pill" data-astro-cid-v2cbyr3p> <div class="info-icon" data-astro-cid-v2cbyr3p><i class="fa-solid fa-graduation-cap" data-astro-cid-v2cbyr3p></i></div> <div class="info-details" data-astro-cid-v2cbyr3p> <span class="info-label" data-astro-cid-v2cbyr3p>Degree</span> <span class="info-value" data-astro-cid-v2cbyr3p>BS in Information Technology</span> </div> </div> <div class="info-pill" data-astro-cid-v2cbyr3p> <div class="info-icon" data-astro-cid-v2cbyr3p><i class="fa-solid fa-location-dot" data-astro-cid-v2cbyr3p></i></div> <div class="info-details" data-astro-cid-v2cbyr3p> <span class="info-label" data-astro-cid-v2cbyr3p>Location</span> <span class="info-value" data-astro-cid-v2cbyr3p>Lapu-Lapu City, Cebu</span> </div> </div> <div class="info-pill" data-astro-cid-v2cbyr3p> <div class="info-icon" data-astro-cid-v2cbyr3p><i class="fa-regular fa-envelope" data-astro-cid-v2cbyr3p></i></div> <div class="info-details" data-astro-cid-v2cbyr3p> <span class="info-label" data-astro-cid-v2cbyr3p>Email</span> <span class="info-value" data-astro-cid-v2cbyr3p>sabidoangel.uc@gmail.com</span> </div> </div> <div class="info-pill" data-astro-cid-v2cbyr3p> <div class="info-icon" data-astro-cid-v2cbyr3p><i class="fa-solid fa-phone" data-astro-cid-v2cbyr3p></i></div> <div class="info-details" data-astro-cid-v2cbyr3p> <span class="info-label" data-astro-cid-v2cbyr3p>Phone</span> <span class="info-value" data-astro-cid-v2cbyr3p>+63 954 291 7099</span> </div> </div> <div class="info-pill" data-astro-cid-v2cbyr3p> <div class="info-icon" data-astro-cid-v2cbyr3p><i class="fa-solid fa-language" data-astro-cid-v2cbyr3p></i></div> <div class="info-details" data-astro-cid-v2cbyr3p> <span class="info-label" data-astro-cid-v2cbyr3p>Languages</span> <span class="info-value" data-astro-cid-v2cbyr3p>English, Filipino</span> </div> </div> </div> </div> </div> </div> <div class="about-content" data-astro-cid-v2cbyr3p> <div class="about-letter" data-astro-cid-v2cbyr3p> <!-- Vintage Postage Stamp --> <div class="postage-stamp" data-astro-cid-v2cbyr3p> <div class="stamp-inner" data-astro-cid-v2cbyr3p> <span class="stamp-country" data-astro-cid-v2cbyr3p>PHILIPPINES</span> <i class="fa-solid fa-cloud-sun stamp-icon" data-astro-cid-v2cbyr3p></i> <span class="stamp-text" data-astro-cid-v2cbyr3p>CEBU</span> <span class="stamp-value" data-astro-cid-v2cbyr3p>20c</span> </div> <div class="stamp-cancel" data-astro-cid-v2cbyr3p></div> </div> <p class="letter-greeting" data-astro-cid-v2cbyr3p>About Me</p> <div class="letter-body" data-astro-cid-v2cbyr3p> <p class="about-text" data-astro-cid-v2cbyr3p>
Hello! I am an <span class="highlight-marker" data-astro-cid-v2cbyr3p>aspiring IT professional</span> with a strong work ethic and a deep passion for creating <span class="highlight-marker" data-astro-cid-v2cbyr3p>user-friendly digital solutions</span>. Throughout my academic journey, I have built a solid foundation in web development, database management, and designing impactful technology that solves real-world problems.
</p> <p class="about-text" data-astro-cid-v2cbyr3p>
Driven by curiosity and a desire to make a <span class="highlight-marker" data-astro-cid-v2cbyr3p>meaningful impact</span>, I thrive on collaboration, attention to detail, and continuous learning. I am eager to leverage my skills to support organizational goals and bring dedication and enthusiasm to every project I undertake.
</p> <!-- Core Competency Badges --> <div class="focus-areas-container" data-astro-cid-v2cbyr3p> <span class="focus-title" data-astro-cid-v2cbyr3p>Core Competencies</span> <div class="focus-badges" data-astro-cid-v2cbyr3p> <div class="focus-badge" data-astro-cid-v2cbyr3p> <span class="badge-emoji" data-astro-cid-v2cbyr3p>💻</span> <span class="badge-text" data-astro-cid-v2cbyr3p>Web Development</span> </div> <div class="focus-badge" data-astro-cid-v2cbyr3p> <span class="badge-emoji" data-astro-cid-v2cbyr3p>🗄️</span> <span class="badge-text" data-astro-cid-v2cbyr3p>Database Systems</span> </div> <div class="focus-badge" data-astro-cid-v2cbyr3p> <span class="badge-emoji" data-astro-cid-v2cbyr3p>🎨</span> <span class="badge-text" data-astro-cid-v2cbyr3p>UI/UX Design</span> </div> <div class="focus-badge" data-astro-cid-v2cbyr3p> <span class="badge-emoji" data-astro-cid-v2cbyr3p>💡</span> <span class="badge-text" data-astro-cid-v2cbyr3p>Problem Solving</span> </div> </div> </div> </div> <!-- Watermark Envelope Icon --> <div class="letter-watermark" data-astro-cid-v2cbyr3p>✉</div> <div class="letter-footer" data-astro-cid-v2cbyr3p> <p class="letter-closing" data-astro-cid-v2cbyr3p>Warmly,</p> <p class="letter-signature" data-astro-cid-v2cbyr3p>${name}</p> </div> </div> </div> </div> <div class="clouds" data-astro-cid-v2cbyr3p> ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-1", "data-astro-cid-v2cbyr3p": true })} ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-2", "data-astro-cid-v2cbyr3p": true })} ${renderComponent($$result, "CloudIcon", CloudIcon, { "class": "cloud-style cloud-3", "data-astro-cid-v2cbyr3p": true })} </div> </section> ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/components/About.astro?astro&type=script&index=0&lang.ts")}`;
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
  const { entries } = await safeGetEmDashCollection("skills");
  if (entries && entries.length > 0) {
    const iconMap = {
      "Programming Languages": "fa-solid fa-code",
      "Web Technologies": "fa-solid fa-laptop-code",
      "Tools & Databases": "fa-solid fa-screwdriver-wrench"
    };
    skillsGroups = entries.map((entry) => {
      const category = entry.data.category || "";
      const skills_list = entry.data.skills_list || "";
      const skills = skills_list ? skills_list.split(",").map((s) => s.trim()) : [];
      const icon = iconMap[category] || "fa-solid fa-cube";
      return { category, icon, skills };
    });
  }
  return renderTemplate`${maybeRenderHead()}<section class="skills" id="skills" data-astro-cid-ab4ihpzs> <h2 class="heading" data-astro-cid-ab4ihpzs>My <span data-astro-cid-ab4ihpzs>Skills</span></h2> <div class="skills-container" data-astro-cid-ab4ihpzs> ${skillsGroups.map((group) => renderTemplate`<div class="skill-box" data-astro-cid-ab4ihpzs> <div class="skill-icon" data-astro-cid-ab4ihpzs> <i${addAttribute(group.icon, "class")} data-astro-cid-ab4ihpzs></i> </div> <h3 data-astro-cid-ab4ihpzs>${group.category}</h3> <div class="skill-list" data-astro-cid-ab4ihpzs> ${group.skills.map((skill) => renderTemplate`<span class="skill-pill" data-astro-cid-ab4ihpzs>${skill}</span>`)} </div> </div>`)} </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Skills.astro", void 0);

const $$Experience = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<section class="experience" id="experience" data-astro-cid-xpq65ryk> <h2 class="heading" data-astro-cid-xpq65ryk>Experience</h2> <div class="experience-container" data-astro-cid-xpq65ryk> <div class="experience-box" data-astro-cid-xpq65ryk> <div class="experience-icon" data-astro-cid-xpq65ryk> <i class="fa-solid fa-briefcase" data-astro-cid-xpq65ryk></i> </div> <h3 data-astro-cid-xpq65ryk>Web Development Internship</h3> <p data-astro-cid-xpq65ryk>Assisted in developing web applications and gained hands-on experience in software development. Worked with modern frameworks and collaborated with senior developers.</p> </div> <div class="experience-box" data-astro-cid-xpq65ryk> <div class="experience-icon" data-astro-cid-xpq65ryk> <i class="fa-solid fa-laptop-code" data-astro-cid-xpq65ryk></i> </div> <h3 data-astro-cid-xpq65ryk>Freelance Graphic Designer</h3> <p data-astro-cid-xpq65ryk>Created websites for small businesses and individuals, enhancing my skills in web design and development. Managed client relationships and delivered projects on time.</p> </div> </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Experience.astro", void 0);

const $$Projects = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Projects;
  function getDeterministicTheme(str, index) {
    const gradients = [
      { bg: "linear-gradient(135deg, #ff7a7a 0%, #ff5252 100%)", text: "#ffffff", label: str.toUpperCase() },
      { bg: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", text: "#ffffff", label: str.toUpperCase() },
      { bg: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", text: "#ffffff", label: str.toUpperCase() },
      { bg: "linear-gradient(135deg, #1d976c 0%, #93f9b9 100%)", text: "#ffffff", label: str.toUpperCase() },
      { bg: "radial-gradient(circle, #232526 0%, #0f2027 100%)", text: "#d4af37", label: str.toUpperCase() },
      { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", text: "#ffffff", label: str.toUpperCase() },
      { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", text: "#ffffff", label: str.toUpperCase() },
      { bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", text: "#ffffff", label: str.toUpperCase() }
    ];
    return gradients[index % gradients.length];
  }
  const defaultProjects = [
    {
      title: "Patio Time Bar",
      description: "A premium, responsive website template for restaurants, bars, and outdoor dining lounges featuring online menus and booking forms.",
      icon: "fa-solid fa-glass-martini-alt",
      tags: ["HTML", "CSS", "JavaScript"],
      project_url: "https://phase-2-patiotimebar.vercel.app/",
      screenshot_url: "https://image.thum.io/get/width/880/crop/540/https://phase-2-patiotimebar.vercel.app/",
      theme: { bg: "linear-gradient(135deg, #e65c00 0%, #f9d423 100%)", text: "#ffffff", label: "PATIO TIME BAR" }
    },
    {
      title: "Auto Dealer Portal",
      description: "Sleek automotive dealership template featuring high-impact vehicle inventory grids, dynamic filters, and a test drive scheduler.",
      icon: "fa-solid fa-car",
      tags: ["Next.js", "Tailwind", "UI/UX"],
      project_url: "https://phase-3-dealertemplate.vercel.app/",
      screenshot_url: "https://image.thum.io/get/width/880/crop/540/https://phase-3-dealertemplate.vercel.app/",
      theme: { bg: "linear-gradient(135deg, #141e30 0%, #243b55 100%)", text: "#ffffff", label: "CAR DEALER PORTAL" }
    },
    {
      title: "Electrician Services",
      description: "A clean, high-converting professional contractor website for electrical diagnostics, emergency repair, and solar installations.",
      icon: "fa-solid fa-bolt",
      tags: ["Astro", "Tailwind", "SEO"],
      project_url: "https://electrician-templatev2.vercel.app/",
      screenshot_url: "https://image.thum.io/get/width/880/crop/540/https://electrician-templatev2.vercel.app/",
      theme: { bg: "linear-gradient(135deg, #f7b733 0%, #fc4a1a 100%)", text: "#ffffff", label: "ELECTRICIAN TEMPLATE V2" }
    },
    {
      title: "HVAC Climate Co.",
      description: "Heating, ventilation, and air conditioning service landing page with scheduled bookings, emergency hotlines, and quote calculator.",
      icon: "fa-solid fa-snowflake",
      tags: ["Responsive", "Astro", "CSS"],
      project_url: "https://hvac-template-rbep.vercel.app/",
      screenshot_url: "https://image.thum.io/get/width/880/crop/540/https://hvac-template-rbep.vercel.app/",
      theme: { bg: "linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)", text: "#ffffff", label: "HVAC CLIMATE CO." }
    },
    {
      title: "Plumbing Experts",
      description: "Modern service layout for plumbing contractors, featuring leak detection, residential drainage, emergency pipeline service booking.",
      icon: "fa-solid fa-faucet-drip",
      tags: ["Astro", "SEO", "Responsive"],
      project_url: "https://plumbing-template-henna.vercel.app/",
      screenshot_url: "https://image.thum.io/get/width/880/crop/540/https://plumbing-template-henna.vercel.app/",
      theme: { bg: "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)", text: "#ffffff", label: "PLUMBING EXPERTS" }
    }
  ];
  let projectsList = [];
  const { entries } = await safeGetEmDashCollection("projects");
  if (entries && entries.length > 0) {
    projectsList = entries.map((entry, index) => {
      const title = entry.data?.title || "";
      const description = entry.data?.description || "";
      const icon = entry.data?.icon || "fa-solid fa-code";
      const tags_str = entry.data?.tags || "";
      const tags = tags_str ? tags_str.split(",").map((t) => t.trim()) : [];
      const project_url = entry.data?.project_url || "";
      const screenshot_url = project_url ? `https://image.thum.io/get/width/880/crop/540/${project_url}` : "";
      const theme = getDeterministicTheme(title, index);
      return { title, description, icon, tags, project_url, screenshot_url, theme };
    });
  } else {
    projectsList = defaultProjects;
  }
  const row1Base = projectsList.filter((_, i) => i % 2 === 0);
  const row2Base = projectsList.filter((_, i) => i % 2 !== 0);
  const row1List = [...row1Base, ...row1Base, ...row1Base];
  const row2List = [...row2Base, ...row2Base, ...row2Base];
  return renderTemplate`${maybeRenderHead()}<section class="projects" id="projects" data-astro-cid-amng4zvp> <h2 class="heading" data-astro-cid-amng4zvp>My <span data-astro-cid-amng4zvp>Projects</span></h2> <div class="projects-carousel-container" data-astro-cid-amng4zvp> <!-- Row 1: moves left as you scroll down --> <div class="projects-track-wrapper track-row-1" data-direction="-1" data-astro-cid-amng4zvp> <div class="projects-track" data-astro-cid-amng4zvp> ${row1List.map((project) => renderTemplate`<div class="project-mockup-card"${addAttribute(project.project_url, "data-url")} data-astro-cid-amng4zvp>  <div class="browser-header" data-astro-cid-amng4zvp> <div class="browser-dots" data-astro-cid-amng4zvp> <span class="dot red" data-astro-cid-amng4zvp></span> <span class="dot yellow" data-astro-cid-amng4zvp></span> <span class="dot green" data-astro-cid-amng4zvp></span> </div> <div class="browser-address" data-astro-cid-amng4zvp>${project.project_url ? new URL(project.project_url).hostname : project.title.toLowerCase().replace(/ /g, "-")}</div> </div>  <div class="mockup-canvas"${addAttribute(project.screenshot_url ? "" : `background: ${project.theme.bg}`, "style")} data-astro-cid-amng4zvp> ${project.screenshot_url ? renderTemplate`<img${addAttribute(project.screenshot_url, "src")}${addAttribute(`${project.title} screenshot`, "alt")} class="mockup-screenshot" loading="lazy" data-astro-cid-amng4zvp>` : renderTemplate`<div class="canvas-content" data-astro-cid-amng4zvp> <div class="canvas-icon"${addAttribute(`color: ${project.theme.text}`, "style")} data-astro-cid-amng4zvp><i${addAttribute(project.icon, "class")} data-astro-cid-amng4zvp></i></div> <h4${addAttribute(`color: ${project.theme.text}`, "style")} data-astro-cid-amng4zvp>${project.theme.label}</h4> </div>`} </div>  <div class="project-detail-overlay" data-astro-cid-amng4zvp> <div class="overlay-content" data-astro-cid-amng4zvp> <span class="project-num" data-astro-cid-amng4zvp>BROWSER PREVIEW</span> <h3 data-astro-cid-amng4zvp>${project.title}</h3> <p data-astro-cid-amng4zvp>${project.description}</p> <div class="project-tags" data-astro-cid-amng4zvp> ${project.tags.map((tag) => renderTemplate`<span class="tag" data-astro-cid-amng4zvp>${tag}</span>`)} </div> ${project.project_url && renderTemplate`<a${addAttribute(project.project_url, "href")} target="_blank" class="project-btn" rel="noopener noreferrer" data-astro-cid-amng4zvp>
View Live <i class="fa-solid fa-arrow-up-right-from-square" data-astro-cid-amng4zvp></i> </a>`} </div> </div> </div>`)} </div> </div> <!-- Row 2: moves right as you scroll down --> <div class="projects-track-wrapper track-row-2" data-direction="1" data-astro-cid-amng4zvp> <div class="projects-track" data-astro-cid-amng4zvp> ${row2List.map((project) => renderTemplate`<div class="project-mockup-card"${addAttribute(project.project_url, "data-url")} data-astro-cid-amng4zvp>  <div class="browser-header" data-astro-cid-amng4zvp> <div class="browser-dots" data-astro-cid-amng4zvp> <span class="dot red" data-astro-cid-amng4zvp></span> <span class="dot yellow" data-astro-cid-amng4zvp></span> <span class="dot green" data-astro-cid-amng4zvp></span> </div> <div class="browser-address" data-astro-cid-amng4zvp>${project.project_url ? new URL(project.project_url).hostname : project.title.toLowerCase().replace(/ /g, "-")}</div> </div>  <div class="mockup-canvas"${addAttribute(project.screenshot_url ? "" : `background: ${project.theme.bg}`, "style")} data-astro-cid-amng4zvp> ${project.screenshot_url ? renderTemplate`<img${addAttribute(project.screenshot_url, "src")}${addAttribute(`${project.title} screenshot`, "alt")} class="mockup-screenshot" loading="lazy" data-astro-cid-amng4zvp>` : renderTemplate`<div class="canvas-content" data-astro-cid-amng4zvp> <div class="canvas-icon"${addAttribute(`color: ${project.theme.text}`, "style")} data-astro-cid-amng4zvp><i${addAttribute(project.icon, "class")} data-astro-cid-amng4zvp></i></div> <h4${addAttribute(`color: ${project.theme.text}`, "style")} data-astro-cid-amng4zvp>${project.theme.label}</h4> </div>`} </div>  <div class="project-detail-overlay" data-astro-cid-amng4zvp> <div class="overlay-content" data-astro-cid-amng4zvp> <span class="project-num" data-astro-cid-amng4zvp>BROWSER PREVIEW</span> <h3 data-astro-cid-amng4zvp>${project.title}</h3> <p data-astro-cid-amng4zvp>${project.description}</p> <div class="project-tags" data-astro-cid-amng4zvp> ${project.tags.map((tag) => renderTemplate`<span class="tag" data-astro-cid-amng4zvp>${tag}</span>`)} </div> ${project.project_url && renderTemplate`<a${addAttribute(project.project_url, "href")} target="_blank" class="project-btn" rel="noopener noreferrer" data-astro-cid-amng4zvp>
View Live <i class="fa-solid fa-arrow-up-right-from-square" data-astro-cid-amng4zvp></i> </a>`} </div> </div> </div>`)} </div> </div> </div> </section> ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/components/Projects.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/sabido/my_portfolio/src/components/Projects.astro", void 0);

const $$Contact = createComponent(async ($$result, $$props, $$slots) => {
  const { entries } = await safeGetEmDashCollection("contact");
  if (entries && entries.length > 0) {
    entries.map((entry) => {
      const platform = entry.data?.platform || "";
      const value = entry.data?.value || "";
      const icon = entry.data?.icon || "";
      return { platform, value, icon };
    });
  }
  return renderTemplate`${maybeRenderHead()}<section class="contact" id="contact" data-astro-cid-xmivup5a> <div class="contact-wrapper" data-astro-cid-xmivup5a> <div class="contact-card-container" data-astro-cid-xmivup5a> <div class="contact-envelope" data-astro-cid-xmivup5a> <!-- Envelope back --> <div class="envelope-back" data-astro-cid-xmivup5a></div> <!-- Envelope front with flap --> <div class="envelope-front" data-astro-cid-xmivup5a> <div class="envelope-flap" data-astro-cid-xmivup5a></div> <div class="envelope-body" data-astro-cid-xmivup5a></div> </div> <!-- Contact info displayed on top of envelope --> <div class="contact-letter" data-astro-cid-xmivup5a> <h2 class="contact-title" data-astro-cid-xmivup5a>Thank You</h2> <p class="contact-subtitle" data-astro-cid-xmivup5a>get in touch!</p> <div class="contact-details" data-astro-cid-xmivup5a> <div class="contact-item" data-astro-cid-xmivup5a> <i class="fa-solid fa-phone" data-astro-cid-xmivup5a></i> <span data-astro-cid-xmivup5a>+63 954 291 7099</span> </div> <div class="contact-item" data-astro-cid-xmivup5a> <i class="fa-solid fa-envelope" data-astro-cid-xmivup5a></i> <span data-astro-cid-xmivup5a>sabidoangel.uc@gmail.com</span> </div> <div class="contact-item" data-astro-cid-xmivup5a> <i class="fa-brands fa-instagram" data-astro-cid-xmivup5a></i> <span data-astro-cid-xmivup5a>@angel_sabido</span> </div> <div class="contact-item" data-astro-cid-xmivup5a> <i class="fa-brands fa-linkedin" data-astro-cid-xmivup5a></i> <span data-astro-cid-xmivup5a>Angel Marie Sabido</span> </div> </div> </div> <!-- Red wax seal --> <div class="wax-seal" data-astro-cid-xmivup5a> <div class="seal-inner" data-astro-cid-xmivup5a> <i class="fa-solid fa-heart" data-astro-cid-xmivup5a></i> </div> </div> </div> </div> </div> </section>`;
}, "C:/Users/sabido/my_portfolio/src/components/Contact.astro", void 0);

const $$Loader = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="en" data-astro-cid-4qws3apc> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Enhanced Loader</title>${renderHead()}</head> <body data-astro-cid-4qws3apc> <!-- =========================
     LOADER
========================= --> <div id="loader" class="loader-container" data-astro-cid-4qws3apc> <div class="loader-content" data-astro-cid-4qws3apc> <div class="envelope-loader" data-astro-cid-4qws3apc> <div class="envelope-shadow" data-astro-cid-4qws3apc></div> <div class="envelope-body" data-astro-cid-4qws3apc></div> <div class="envelope-flap" data-astro-cid-4qws3apc></div> <div class="letter" data-astro-cid-4qws3apc> <div class="letter-line" data-astro-cid-4qws3apc></div> <div class="letter-line short" data-astro-cid-4qws3apc></div> </div> </div> </div> </div> ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/components/Loader.astro?astro&type=script&index=0&lang.ts")} </body> </html>`;
}, "C:/Users/sabido/my_portfolio/src/components/Loader.astro", void 0);

const $$Index = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Index;
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><meta name="viewport" content="width=device-width"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>My Portfolio</title>${renderHead()}</head> <body> ${renderComponent($$result, "Loader", $$Loader, {})} ${renderComponent($$result, "Home", $$Home, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "dark-to-light", "class": "home-divider" })} ${renderComponent($$result, "About", $$About, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "light-to-dark" })} ${renderComponent($$result, "Skills", $$Skills, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "dark-to-light" })} ${renderComponent($$result, "Projects", $$Projects, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "light-to-dark" })} ${renderComponent($$result, "Experience", $$Experience, {})} ${renderComponent($$result, "Divider", $$Divider, { "type": "dark-to-light" })} ${renderComponent($$result, "Contact", $$Contact, {})} ${renderScript($$result, "C:/Users/sabido/my_portfolio/src/pages/index.astro?astro&type=script&index=0&lang.ts")} </body> </html>`;
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
