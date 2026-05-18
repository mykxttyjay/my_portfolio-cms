import { a8 as __exportAll } from './adapt-sandbox-entry_H5gl0boC.mjs';

//#region src/seed/load.ts
var load_exports = /* @__PURE__ */ __exportAll({
	loadSeed: () => loadSeed,
	loadUserSeed: () => loadUserSeed
});
async function getSeedModule() {
	return import('./seed_D17Gm8WP.mjs');
}
/**
* Load the seed file (user seed or default).
*/
async function loadSeed() {
	const { seed } = await getSeedModule();
	return seed;
}
/**
* Load the user's seed file, or null if none exists.
*/
async function loadUserSeed() {
	const { userSeed } = await getSeedModule();
	return userSeed ?? null;
}

export { loadUserSeed as n, load_exports as r, loadSeed as t };
