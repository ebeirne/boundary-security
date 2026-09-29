import {PGlite} from '@electric-sql/pglite';
import {createHash,randomUUID} from 'node:crypto';
import {toolVersion,databasePackageVersion} from './version.mjs';
import {createAssessment,canonical} from './assessment-core.mjs';
export {canonical};
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
export const {assess,limitations}=createAssessment({hash,randomUUID,toolVersion,databasePackageVersion,defaultDatabase:()=>PGlite.create(),runtime:()=>({v8:process.versions.v8,node:process.version,platform:process.platform,arch:process.arch,rssBytes:process.memoryUsage().rss})});
export function verifyIntegrity(run){const {integrity,...content}=run;return Boolean(integrity?.digest&&hash(content)===integrity.digest)}
