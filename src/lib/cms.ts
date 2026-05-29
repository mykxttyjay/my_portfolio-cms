/**
 * Centralized CMS loader for EmDash.
 *
 * EmDash (the SQLite-backed CMS) is the single source of truth at runtime.
 * `seed/seed.json` defines the schema only — its `content` arrays are empty
 * by design. Real content lives in the database and is edited through the
 * admin UI at `/_emdash/admin`.
 *
 * EmDash uses snake_case field slugs, so the loaders map them back to
 * camelCase here. If a collection is empty (e.g. on a freshly bootstrapped
 * install before the editor has added anything), the loader returns a
 * neutral empty value so the page can still render.
 */

import { getEmDashCollection } from 'emdash';

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
  thumbnail?: string;
  thumbnailAlt?: string;
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
const LOCAL_MEDIA_BASE_URL = '/_emdash/api/media/file';

function extractImageSrc(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.src === 'string' && obj.src.length > 0) return obj.src;
    if (typeof obj.url === 'string' && obj.url.length > 0) return obj.url;
    if (typeof obj.previewUrl === 'string' && obj.previewUrl.length > 0)
      return obj.previewUrl;
    const meta = obj.meta as Record<string, unknown> | undefined;
    const storageKey =
      (typeof obj.storageKey === 'string' && obj.storageKey) ||
      (meta && typeof meta.storageKey === 'string' && meta.storageKey) ||
      undefined;
    if (storageKey) return `${LOCAL_MEDIA_BASE_URL}/${storageKey}`;
  }
  return null;
}

function extractPhotoSrc(value: unknown): string {
  return extractImageSrc(value) ?? DEFAULT_PHOTO;
}

function mapProject(data: Record<string, unknown>): Project {
  const thumbnailSrc = extractImageSrc(data.thumbnail);
  return {
    title: str(data.title),
    description: typeof data.description === 'string' ? data.description : undefined,
    thumbnail: thumbnailSrc ?? undefined,
    thumbnailAlt:
      typeof data.thumbnail_alt === 'string' ? data.thumbnail_alt : undefined,
    link: typeof data.link === 'string' ? data.link : undefined,
    icon: typeof data.icon === 'string' ? data.icon : undefined,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    display_order:
      typeof data.display_order === 'number' ? data.display_order : undefined,
  };
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

const EMPTY_HOME: Home = mapHome({});
const EMPTY_ABOUT: AboutMe = mapAboutMe({});
const EMPTY_CONTACT: Contact = mapContact({});

export async function getHome(): Promise<Home> {
  try {
    const { entries } = await getEmDashCollection('home' as never, {
      limit: 1,
    });
    const entry = entries[0];
    if (entry?.data) return mapHome(entry.data as Record<string, unknown>);
  } catch {
    /* DB unreachable — fall through to empty defaults */
  }
  return EMPTY_HOME;
}

export async function getAboutMe(): Promise<AboutMe> {
  try {
    const { entries } = await getEmDashCollection('about_me' as never, {
      limit: 1,
    });
    const entry = entries[0];
    if (entry?.data) return mapAboutMe(entry.data as Record<string, unknown>);
  } catch {
    /* DB unreachable — fall through to empty defaults */
  }
  return EMPTY_ABOUT;
}

export async function getProjects(): Promise<Project[]> {
  try {
    const { entries } = await getEmDashCollection('projects' as never);
    return sortByOrder(
      entries.map((e) => mapProject(e.data as Record<string, unknown>))
    );
  } catch {
    return [];
  }
}

export async function getSkills(): Promise<Skill[]> {
  try {
    const { entries } = await getEmDashCollection('skills' as never);
    return sortByOrder(entries.map((e) => e.data as unknown as Skill));
  } catch {
    return [];
  }
}

export async function getExperience(): Promise<Experience[]> {
  try {
    const { entries } = await getEmDashCollection('experience' as never);
    return sortByOrder(entries.map((e) => e.data as unknown as Experience));
  } catch {
    return [];
  }
}

export async function getContact(): Promise<Contact> {
  try {
    const { entries } = await getEmDashCollection('contact' as never, {
      limit: 1,
    });
    const entry = entries[0];
    if (entry?.data) return mapContact(entry.data as Record<string, unknown>);
  } catch {
    /* DB unreachable — fall through to empty defaults */
  }
  return EMPTY_CONTACT;
}
