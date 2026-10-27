import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,renameSync,cpSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {installPortableExtension,extensionPath,removePortableExtension} from '../src/portable-extensions.mjs';
mkdirSync(join(import.meta.dirname,'../test-results'),{recursive:true});
function fixture(){const root=mkdtempSync(join(import.meta.dirname,'../test-results/extensions-')),source=join(root,'source'),data=join(root,'data');mkdirSync(source);mkdirSync(data);writeFileSync(join(source,'manifest.json'),JSON.stringify({manifest_version:3,name:'Portable fixture',version:'1.0'}));writeFileSync(join(source,'content.js'),'globalThis.fixture=true;');return {root,source,data,id:randomUUID()};}
test('Extension survives source removal and data relocation with stable identity',()=>{
 const f=fixture(),installed=installPortableExtension(f.data,f.id,f.source),record={id:installed.id,directory:installed.directory};
 assert.equal(JSON.parse(readFileSync(join(f.source,'manifest.json'))).key,undefined);
 renameSync(f.source,join(f.root,'original-moved'));const moved=join(f.root,'data-moved');renameSync(f.data,moved);
 const target=extensionPath(moved,f.id,record);assert.equal(readFileSync(join(target,'content.js'),'utf8'),'globalThis.fixture=true;');
 const other=join(f.root,'other');mkdirSync(other);const again=installPortableExtension(other,randomUUID(),target);assert.equal(again.id,installed.id);
 removePortableExtension(moved,f.id,record);assert.equal(existsSync(target),false);assert.ok(existsSync(join(f.root,'original-moved','manifest.json')));
});
test('Invalid manifests and paths do not create or delete external packages',()=>{
 const f=fixture();writeFileSync(join(f.source,'manifest.json'),'{}');assert.throws(()=>installPortableExtension(f.data,f.id,f.source),/manifest/);assert.equal(existsSync(join(f.data,'extensions')),false);
 assert.throws(()=>extensionPath(f.data,f.id,{directory:'../source'}),/identifier/);assert.throws(()=>removePortableExtension(f.data,'../source',{directory:randomUUID()}),/identifier/);
 removePortableExtension(f.data,f.id,{path:f.source});assert.ok(existsSync(f.source));
});
test('Junctions in extension sources and managed storage are refused',()=>{
 const f=fixture(),external=join(f.root,'external');mkdirSync(external);writeFileSync(join(external,'keep.txt'),'preserve');symlinkSync(external,join(f.source,'linked'),'junction');
 assert.throws(()=>installPortableExtension(f.data,f.id,f.source),/links/);
 mkdirSync(join(f.data,'extensions'));symlinkSync(external,join(f.data,'extensions',f.id),'junction');assert.throws(()=>removePortableExtension(f.data,f.id,{directory:randomUUID()}),/External/);assert.equal(readFileSync(join(external,'keep.txt'),'utf8'),'preserve');
});

// A clean source checkout does not contain generated test output folders.
