import fs from 'fs';
import path from 'path';

interface EmdashData {
	profile: any[];
	skills: any[];
	projects: any[];
	contact: any[];
}

let cachedData: EmdashData | null = null;

export function getEmdashData(): EmdashData {
	if (cachedData) {
		return cachedData;
	}

	try {
		const seedPath = path.join(process.cwd(), '.emdash', 'seed.json');
		const seedContent = fs.readFileSync(seedPath, 'utf-8');
		const seedData = JSON.parse(seedContent);

		cachedData = {
			profile: seedData.content.profile || [],
			skills: seedData.content.skills || [],
			projects: seedData.content.projects || [],
			contact: seedData.content.contact || [],
		};

		return cachedData;
	} catch (error) {
		console.error('Error loading Emdash data:', error);
		return {
			profile: [],
			skills: [],
			projects: [],
			contact: [],
		};
	}
}

export function getProfile() {
	const data = getEmdashData();
	return data.profile[0]?.data || null;
}

export function getSkills() {
	const data = getEmdashData();
	return data.skills.map((skill) => skill.data);
}

export function getProjects() {
	const data = getEmdashData();
	return data.projects.map((project) => project.data);
}

export function getContact() {
	const data = getEmdashData();
	return data.contact.map((contact) => contact.data);
}
