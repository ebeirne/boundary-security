import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openStore} from '../server/store.mjs';
import {demoProject} from '../server/demo.mjs';
const initial=()=>({projects:[demoProject()],runs:[]});
const dir=()=>mkdtempSync(path.join(tmpdir(),'boundary-store-'));
test('commit preserves a previous snapshot and reloads the current one',()=>{
 const d=dir(),s=openStore(d,initial()),next=structuredClone(s.value);next.projects[0].name='Renamed';s.commit(next);
 assert.equal(openStore(d,initial()).value.projects[0].name,'Renamed');
 assert.equal(JSON.parse(readFileSync(path.join(d,'state.json.bak'))).projects[0].name,'Northstar client portal');
});
test('disk write failure cannot advance memory or replace persisted state',()=>{
 const d=dir();openStore(d,initial());const s=openStore(d,initial(),{write:()=>{throw new Error('disk full');}}),next=structuredClone(s.value);next.projects[0].name='Unsaved';
 assert.throws(()=>s.commit(next),/disk full/);assert.equal(s.value.projects[0].name,'Northstar client portal');assert.equal(openStore(d,initial()).value.projects[0].name,'Northstar client portal');
});
test('corrupt or tampered workspace fails closed without replacing evidence',()=>{
 const d=dir();openStore(d,initial());writeFileSync(path.join(d,'state.json'),'{bad');assert.throws(()=>openStore(d,initial()),/preserved/);assert.equal(readFileSync(path.join(d,'state.json'),'utf8'),'{bad');
 const bad=initial();bad.runs=[{id:'tamper',projectId:'demo',integrity:{digest:'fake'}}];writeFileSync(path.join(d,'state.json'),JSON.stringify(bad));assert.throws(()=>openStore(d,initial()),/preserved/);
});

test('unknown workspace formats are rejected without changing any saved bytes',()=>{
 for(const formatVersion of [2,0,null,'1']){
  const d=dir(),state={...initial(),formatVersion},bytes=JSON.stringify(state);
  writeFileSync(path.join(d,'state.json'),bytes);
  assert.throws(()=>openStore(d,initial()),/preserved/);
  assert.equal(readFileSync(path.join(d,'state.json'),'utf8'),bytes);
 }
});
test('legacy and current workspace formats remain readable',()=>{
 for(const state of [initial(),{...initial(),formatVersion:1}]){
  const d=dir();writeFileSync(path.join(d,'state.json'),JSON.stringify(state));
  assert.equal(openStore(d,initial()).value.projects[0].id,'demo');
 }
});
for(const stage of ['sync','copy','backup-rename','state-rename'])test(`failed ${stage} preserves current state and a valid recovery snapshot`,()=>{
 const d=dir(),first=openStore(d,initial()),saved=structuredClone(first.value);
 saved.projects[0].name='Saved revision';first.commit(saved);
 const current=readFileSync(path.join(d,'state.json'),'utf8');
 const fail=()=>{throw Error('injected persistence failure');};
 const options=stage==='sync'?{sync:fail}:stage==='copy'?{copy:fail}:{rename:(from,to)=>{
  if((stage==='backup-rename'&&to.endsWith('.bak'))||(stage==='state-rename'&&to.endsWith('state.json')))fail();
  renameSync(from,to);
 }};
 const store=openStore(d,initial(),options),next=structuredClone(store.value);next.projects[0].name='Not saved';
 assert.throws(()=>store.commit(next),/injected/);
 assert.equal(store.value.projects[0].name,'Saved revision');
 assert.equal(readFileSync(path.join(d,'state.json'),'utf8'),current);
 const backup=JSON.parse(readFileSync(path.join(d,'state.json.bak'),'utf8'));
 assert.ok(['Northstar client portal','Saved revision'].includes(backup.projects[0].name));
 assert.equal(openStore(d,initial()).value.projects[0].name,'Saved revision');
});

