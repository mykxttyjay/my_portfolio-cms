import fs from 'node:fs';
const t = fs.readFileSync('node_modules/emdash/dist/cli/index.mjs', 'utf8');
const start = t.indexOf('//#region src/cli/credentials.ts');
const end = t.indexOf('//#endregion', start) + 12;
console.log(t.slice(start, end));
