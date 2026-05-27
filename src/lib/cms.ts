/**
 * Centralized CMS loader for EmDash.
 *
 * Each helper queries EmDash and falls back to local JSON files when EmDash
 * is unreachable (e.g. during a fresh build before the database is bootstrapped).
 * The local JSON files act as the source of truth for shape; EmDash uses
 * snake_case slugs which are mapped back to camelCase here.
 */

import { getEmDashCollection } from 'emdash';
import profileJson from '../data/profile.json';
import projectsJson from '../data/projects.json';
import skillsJson from '../data/skills.json';
import experienceJson from '../data/experience.json';
import contactJson from '../data/contact.json';

type Profile = typeof profileJson;
type Project = (typeof projectsJson)[number];
type Skill = (typeof skillsJson)[number];
type Experience = (typeof experienceJson)[number];
type Contact = typeof contactJson;

const sortByOrder = <T extends { display_order?: number; order?: number }>(
  list: T[]
): T[] =>
  [...list].sort(
    (a, b) =>
      (a.display_order ?? a.order ?? 0) - (b.display_order ?? b.order ?? 0)
  );

function mapProfile(data: Record<string, unknown>): Profile {
  return {
    ...profileJson,
    firstName: (data.first_name as string) ?? profileJson.firstName,
    lastName: (data.last_name as string) ?? profileJson.lastName,
    title: (data.title as string) ?? profileJson.title,
    intro: (data.intro as string) ?? profileJson.intro,
    aboutParagraph1:
      (data.about_paragraph_1 as string) ?? profileJson.aboutParagraph1,
    aboutParagraph2:
      (data.about_paragraph_2 as string) ?? profileJson.aboutParagraph2,
    birthday: (data.birthday as string) ?? profileJson.birthday,
    degree: (data.degree as string) ?? profileJson.degree,
    location: (data.location as string) ?? profileJson.location,
    email: (data.email as string) ?? profileJson.email,
    specialization:
      (data.specialization as string) ?? profileJson.specialization,
    skillsDescription:
      (data.skills_description as string) ?? profileJson.skillsDescription,
  };
}

function mapContact(data: Record<string, unknown>): Contact {
  return {
    email: (data.email as string) ?? contactJson.email,
    phone: (data.phone as string) ?? contactJson.phone,
    github: (data.github as string) ?? contactJson.github,
    linkedin: (data.linkedin as string) ?? contactJson.linkedin,
    resumeLink: (data.resume_link as string) ?? contactJson.resumeLink,
  };
}

export async function getProfile(): Promise<Profile> {
  try {
    const { entries } = await getEmDashCollection('profile' as never, {
      limit: 1,
    });
    const entry = entries[0];
    if (entry?.data) return mapProfile(entry.data as Record<string, unknown>);
  } catch {
    /* fall through */
  }
  return profileJson;
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
  return projectsJson as Project[];
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
  return skillsJson as Skill[];
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
  return experienceJson as Experience[];
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
  return contactJson;
}
