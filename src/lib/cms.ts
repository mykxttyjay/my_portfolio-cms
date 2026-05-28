/**
 * Centralized CMS loader for EmDash.
 *
 * Each helper queries EmDash and falls back to the seed file when EmDash
 * is unreachable (e.g. during a fresh build before the database is bootstrapped).
 * `seed/seed.json` is the single source of truth — both the schema and the
 * default content live there. EmDash uses snake_case field slugs, so the
 * loaders map them back to camelCase here.
 */

import { getEmDashCollection } from 'emdash';
import seed from '../../seed/seed.json';

type SeedEntry<T = Record<string, unknown>> = {
  id?: string;
  slug?: string;
  status?: string;
  data: T;
};

const seedContent = seed.content as {
  home: SeedEntry[];
  about_me: SeedEntry[];
  projects: SeedEntry[];
  skills: SeedEntry[];
  experience: SeedEntry[];
  contact: SeedEntry[];
};

export interface Home {
  firstName: string;
  lastName: string;
  title: string;
  intro: string;
}

export interface AboutMe {
  photo: string;
  photoAlt: string;
  aboutParagraph1: string;
  aboutParagraph2: string;
  birthday: string;
  degree: string;
  location: string;
  email: string;
  specialization: string;
}

export interface Project {
  title: string;
  description?: string;
  link?: string;
  icon?: string;
  tags?: string[];
  display_order?: number;
}

export interface Skill {
  name: string;
  description?: string;
  category: string;
  icon: string;
  display_order?: number;
}

export interface Experience {
  title: string;
  description?: string;
  company: string;
  date: string;
  display_order?: number;
}

export interface Contact {
  email: string;
  phone?: string;
  github?: string;
  linkedin?: string;
  resumeLink: string;
}

const sortByOrder = <T extends { display_order?: number; order?: number }>(
  list: T[]
): T[] =>
  [...list].sort(
    (a, b) =>
      (a.display_order ?? a.order ?? 0) - (b.display_order ?? b.order ?? 0)
  );

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;

function mapHome(data: Record<string, unknown>): Home {
  return {
    firstName: str(data.first_name),
    lastName: str(data.last_name),
    title: str(data.title),
    intro: str(data.intro),
  };
}

const DEFAULT_PHOTO = '/profile.jpg';

function extractPhotoSrc(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.src === 'string' && obj.src.length > 0) return obj.src;
    if (typeof obj.previewUrl === 'string' && obj.previewUrl.length > 0)
      return obj.previewUrl;
  }
  return DEFAULT_PHOTO;
}

function mapAboutMe(data: Record<string, unknown>): AboutMe {
  return {
    photo: extractPhotoSrc(data.photo),
    photoAlt: str(data.photo_alt),
    aboutParagraph1: str(data.about_paragraph_1),
    aboutParagraph2: str(data.about_paragraph_2),
    birthday: str(data.birthday),
    degree: str(data.degree),
    location: str(data.location),
    email: str(data.email),
    specialization: str(data.specialization),
  };
}

function mapContact(data: Record<string, unknown>): Contact {
  return {
    email: str(data.email),
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    github: typeof data.github === 'string' ? data.github : undefined,
    linkedin: typeof data.linkedin === 'string' ? data.linkedin : undefined,
    resumeLink: str(data.resume_link),
  };
}

const seedHome: Home = mapHome(seedContent.home[0]?.data ?? {});
const seedAboutMe: AboutMe = mapAboutMe(seedContent.about_me[0]?.data ?? {});
const seedContact: Contact = mapContact(seedContent.contact[0]?.data ?? {});
const seedProjects: Project[] = seedContent.projects.map(
  (e) => e.data as unknown as Project
);
const seedSkills: Skill[] = seedContent.skills.map(
  (e) => e.data as unknown as Skill
);
const seedExperience: Experience[] = seedContent.experience.map(
  (e) => e.data as unknown as Experience
);

export async function getHome(): Promise<Home> {
  try {
    const { entries } = await getEmDashCollection('home' as never, {
      limit: 1,
    });
    const entry = entries[0];
    if (entry?.data) return mapHome(entry.data as Record<string, unknown>);
  } catch {
    /* fall through */
  }
  return seedHome;
}

export async function getAboutMe(): Promise<AboutMe> {
  try {
    const { entries } = await getEmDashCollection('about_me' as never, {
      limit: 1,
    });
    const entry = entries[0];
    if (entry?.data) return mapAboutMe(entry.data as Record<string, unknown>);
  } catch {
    /* fall through */
  }
  return seedAboutMe;
}

export async function getProjects(): Promise<Project[]> {
  try {
    const { entries } = await getEmDashCollection('projects' as never);
    if (entries.length > 0) {
      return sortByOrder(entries.map((e) => e.data as unknown as Project));
    }
  } catch {
    /* fall through */
  }
  return sortByOrder(seedProjects);
}

export async function getSkills(): Promise<Skill[]> {
  try {
    const { entries } = await getEmDashCollection('skills' as never);
    if (entries.length > 0) {
      return sortByOrder(entries.map((e) => e.data as unknown as Skill));
    }
  } catch {
    /* fall through */
  }
  return sortByOrder(seedSkills);
}

export async function getExperience(): Promise<Experience[]> {
  try {
    const { entries } = await getEmDashCollection('experience' as never);
    if (entries.length > 0) {
      return sortByOrder(entries.map((e) => e.data as unknown as Experience));
    }
  } catch {
    /* fall through */
  }
  return sortByOrder(seedExperience);
}

export async function getContact(): Promise<Contact> {
  try {
    const { entries } = await getEmDashCollection('contact' as never, {
      limit: 1,
    });
    const entry = entries[0];
    if (entry?.data) return mapContact(entry.data as Record<string, unknown>);
  } catch {
    /* fall through */
  }
  return seedContact;
}
