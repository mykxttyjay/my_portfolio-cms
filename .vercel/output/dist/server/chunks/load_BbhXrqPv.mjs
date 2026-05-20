async function getSeedModule() {
  return import('./seed_D17Gm8WP.mjs');
}
async function loadSeed() {
  const { seed } = await getSeedModule();
  return seed;
}
async function loadUserSeed() {
  const { userSeed } = await getSeedModule();
  return userSeed ?? null;
}

export { loadSeed as a, loadUserSeed as l };
