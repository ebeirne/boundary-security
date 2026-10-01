import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRuns} from '../src/run-comparison.mjs';
const before={contractHash:'a',toolVersion:'1',engineVersion:'pg17',databasePackageVersion:'1',sourceHash:'a',results:[{id:'one',label:'Cross customer',status:'failed'}]};
test('same requirements record an outcome change',()=>{const result=compareRuns(before,{...before,sourceHash:'b',results:[{...before.results[0],status:'passed'}]});assert.equal(result.comparable,true);assert.equal(result.changes[0].from,'failed');assert.equal(result.sourceChanged,true)});
test('removing failed requirements is not a repair',()=>{const result=compareRuns(before,{...before,contractHash:'b',results:[]});assert.equal(result.comparable,false);assert.deepEqual(result.removed,['Cross customer'])});
test('changed engine cannot silently count as a repair',()=>assert.equal(compareRuns(before,{...before,engineVersion:'pg18'}).comparable,false));
