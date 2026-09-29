import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createBackup,verifyBackup,restoreBackup} from '../server/backup.mjs';
import {openStore} from '../server/store.mjs';
import {demoProject} from '../server/demo.mjs';
function fixture(t){const root=mkdtempSync(path.join(tmpdir(),'boundary-backup-'));t.after(()=>rmSync(root,{recursive:true,force:true}));openStore(root,{projects:[demoProject()],runs:[]});return {root,file:path.join(root,'backup.json'),dest:path.join(root,'recovered')};}
test('backup restores exact workspace bytes into a new directory',t=>{const {root,file,dest}=fixture(t);createBackup(root,file);restoreBackup(file,dest);assert.deepEqual(readFileSync(path.join(root,'state.json')),readFileSync(path.join(dest,'state.json')));assert.equal(verifyBackup(file).state.projects.length,1);});
test('backup and restore refuse to overwrite existing files or workspaces',t=>{const {root,file}=fixture(t);createBackup(root,file);const original=readFileSync(file);assert.throws(()=>createBackup(root,file),/EEXIST/);assert.deepEqual(readFileSync(file),original);const state=readFileSync(path.join(root,'state.json'));assert.throws(()=>restoreBackup(file,root),/EEXIST/);assert.deepEqual(readFileSync(path.join(root,'state.json')),state);});
test('damaged backup is rejected before creating a recovery directory',t=>{const {root,file,dest}=fixture(t);createBackup(root,file);const envelope=JSON.parse(readFileSync(file));envelope.payload+=' ';writeFileSync(file,JSON.stringify(envelope));assert.throws(()=>restoreBackup(file,dest),/checksum/);assert.equal(existsSync(dest),false);});
test('invalid source evidence does not create a backup',t=>{const {root,file}=fixture(t);const state=JSON.parse(readFileSync(path.join(root,'state.json')));state.runs=[{id:'bad',projectId:state.projects[0].id}];writeFileSync(path.join(root,'state.json'),JSON.stringify(state));assert.throws(()=>createBackup(root,file));assert.equal(existsSync(file),false);});
