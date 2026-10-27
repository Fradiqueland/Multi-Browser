import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Store,validateProfile} from '../src/core.mjs';
import {commitProfileImport,stageProfileImport} from '../src/profile-import.mjs';
mkdirSync(join(import.meta.dirname,'../test-results'),{recursive:true});
const gate=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const workspace=()=>new Store(mkdtempSync(join(import.meta.dirname,'../test-results/import-transaction-')));
test('Importacao pendente nao publica perfis nem grupos em memoria ou disco',async()=>{
 const store=workspace(),existing=store.upsert({name:'Existing'}),profile=validateProfile({name:'Pending',groups:['Imported group']}),ready=gate();
 const job=stageProfileImport({store,profiles:[profile],groups:[{name:'Imported group',description:'New'}],prepare:()=>ready.promise});
 assert.deepEqual(store.state.profiles.map(p=>p.id),[existing.id]);assert.ok(!store.state.groups.includes('Imported group'));store.save();assert.ok(!readFileSync(store.file,'utf8').includes('Pending'));
 ready.resolve();await job;assert.equal(store.get(profile.id),profile);assert.equal(store.get(existing.id),existing);
});
test('Falha conserva alteracoes concorrentes e descarta apenas a identidade temporaria',async()=>{
 const store=workspace(),existing=store.upsert({name:'Existing'}),profile=validateProfile({name:'Failed import'}),ready=gate(),discarded=[];
 const job=stageProfileImport({store,profiles:[profile],prepare:()=>ready.promise,discard:p=>discarded.push(p.id)});
 const added=store.upsert({name:'Created during import'});existing.notes='Concurrent edit';store.state.settings.language='fr';store.save();
 ready.reject(Error('Injected cookie failure'));await assert.rejects(job,/Injected cookie failure/);
 assert.equal(store.get(existing.id).notes,'Concurrent edit');assert.equal(store.get(added.id),added);assert.equal(store.state.settings.language,'fr');assert.deepEqual(discarded,[profile.id]);assert.ok(!store.state.profiles.includes(profile));assert.equal(new Store(store.directory).get(added.id).name,added.name);
});
test('Sucesso combina os dados importados com o estado mais recente sem recriar perfis vivos',async()=>{
 const store=workspace(),existing=store.upsert({name:'Live reference'}),profile=validateProfile({name:'Imported',groups:['New group']}),ready=gate();
 const job=stageProfileImport({store,profiles:[profile],groups:[{name:'New group',description:'Imported description'}],prepare:()=>ready.promise});
 const added=store.upsert({name:'Concurrent'});store.state.settings.language='ar';store.history(existing.id,'https://example.test/','During import');ready.resolve();await job;
 assert.equal(store.get(existing.id),existing);assert.equal(store.get(added.id),added);assert.equal(store.state.settings.language,'ar');assert.equal(store.state.history.length,1);assert.equal(store.state.groupDetails['New group'].description,'Imported description');assert.equal(new Store(store.directory).state.profiles.length,3);
});
test('Duas importacoes simultaneas conservam ambos os resultados independentemente da ordem',async()=>{
 const store=workspace(),a=validateProfile({name:'A'}),b=validateProfile({name:'B'}),ga=gate(),gb=gate();
 const ja=stageProfileImport({store,profiles:[a],prepare:()=>ga.promise}),jb=stageProfileImport({store,profiles:[b],prepare:()=>gb.promise});
 gb.resolve();await jb;ga.resolve();await ja;assert.deepEqual(store.state.profiles.map(p=>p.name),['B','A']);
});
test('Limites sao novamente verificados no commit e nao apagam o perfil criado entretanto',async()=>{
 const store=workspace();store.state.profiles=Array.from({length:999},(_,i)=>validateProfile({name:'Profile '+i}));store.save();const ready=gate(),profile=validateProfile({name:'Pending'}),discarded=[];
 const job=stageProfileImport({store,profiles:[profile],prepare:()=>ready.promise,discard:p=>discarded.push(p.id)});const last=store.upsert({name:'Last available slot'});ready.resolve();await assert.rejects(job,/1000/);assert.equal(store.state.profiles.length,1000);assert.equal(store.get(last.id),last);assert.deepEqual(discarded,[profile.id]);
});
test('Falha de gravacao conserva o objeto anterior e nao publica grupos importados',()=>{
 const store=workspace(),existing=store.upsert({name:'Existing'}),previous=store.state,profile=validateProfile({name:'New',groups:['Only in import']});store.save=()=>{throw Error('Disk full fixture');};
 assert.throws(()=>commitProfileImport(store,[profile],[{name:'Only in import',description:'No'}]),/Disk full/);assert.equal(store.state,previous);assert.equal(store.get(existing.id),existing);assert.ok(!store.state.groups.includes('Only in import'));
});
test('Limpeza tenta todos os perfis e conserva o erro original quando um descarte falha',async()=>{
 const store=workspace(),a=validateProfile({name:'A'}),b=validateProfile({name:'B'}),attempted=[];
 await assert.rejects(stageProfileImport({store,profiles:[a,b],prepare:()=>{throw Error('Original failure');},discard:p=>{attempted.push(p.id);if(p===a)throw Error('Cleanup failure');}}),e=>e instanceof AggregateError&&e.errors.length===2&&e.cause.message==='Original failure');assert.deepEqual(new Set(attempted),new Set([a.id,b.id]));assert.equal(store.state.profiles.length,0);
});
test('Identidades repetidas e limites de grupos falham antes de criar ficheiros',async()=>{
 const store=workspace(),existing=store.upsert({name:'Existing'});let prepared=false;
 await assert.rejects(stageProfileImport({store,profiles:[existing],prepare:()=>{prepared=true;}}),/repetida/);assert.equal(prepared,false);
 store.state.groups=Array.from({length:1000},(_,i)=>'Group '+i);await assert.rejects(stageProfileImport({store,profiles:[validateProfile({name:'New',groups:['Overflow']})],prepare:()=>{prepared=true;}}),/1000 grupos/);assert.equal(prepared,false);
});

// A clean source checkout does not contain generated test output folders.
