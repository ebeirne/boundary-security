import {readFileSync} from 'node:fs';
export const toolVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
export const databasePackageVersion=JSON.parse(readFileSync(new URL('../node_modules/@electric-sql/pglite/package.json',import.meta.url),'utf8')).version;
