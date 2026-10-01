import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,existsSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('release packaging cannot silently omit untracked source',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'boundary-package-'));
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
 try{
  mkdirSync(path.join(root,'scripts'));
  mkdirSync(path.join(root,'src'));
  copyFileSync(fileURLToPath(new URL('../scripts/package-release.mjs',import.meta.url)),path.join(root,'scripts/package-release.mjs'));
  writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'0.0.0-test',type:'module'}));
  writeFileSync(path.join(root,'src','baseline.js'),'export const baseline=true;\n');
  for(const directory of ['server','public','tests','docs','evidence','.github','examples']){
   mkdirSync(path.join(root,directory));
   writeFileSync(path.join(root,directory,'fixture.txt'),'Test fixture\n');
  }
  const extraFiles=['LICENSE','THIRD_PARTY_NOTICES.md','SECURITY.md','CONTRIBUTING.md','package-lock.json','index.html','vite.config.js','README.md','VERIFICATION.md','Start-Boundary.cmd','start-boundary.sh','.gitignore'];
  for(const filename of extraFiles)writeFileSync(path.join(root,filename),'');
  git(['init','--quiet']);
  git(['add','package.json','scripts/package-release.mjs','src/baseline.js','server','public','tests','docs','evidence','.github','examples',...extraFiles]);
  git(['-c','user.name=Boundary Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','Test fixture']);
  const run=destination=>spawnSync(process.execPath,['scripts/package-release.mjs',destination],{cwd:root,encoding:'utf8',windowsHide:true});
  const clean=path.join(root,'clean-output');
  const good=run(clean);
  assert.equal(good.status,0,good.stderr);
  const manifest=JSON.parse(readFileSync(path.join(clean,'release-manifest.json'),'utf8'));
  assert.equal(manifest.commit,git(['rev-parse','HEAD']).trim());
  assert.equal(manifest.sha256,createHash('sha256').update(readFileSync(path.join(clean,manifest.filename))).digest('hex'));
  writeFileSync(path.join(root,'src','new-feature.js'),'export const newFeature=true;\n');
  const blocked=path.join(root,'blocked-output');
  const bad=run(blocked);
  assert.notEqual(bad.status,0);
  assert.match(bad.stderr,/untracked file.*git archive would omit/s);
  assert.equal(existsSync(blocked),false,'refuse before creating a partial release directory');
 }finally{
  // This path is exclusively created by mkdtempSync for this fixture.
  rmSync(root,{recursive:true,force:true});
 }
});
