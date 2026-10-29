import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {validateProfile,Store,configurationBundle,importProfileConfiguration} from '../src/core.mjs';
import {csvText,csvImport} from '../src/workspace.mjs';
import {standardArguments,launchStandardBrowser} from '../src/standard-browser.mjs';
import {NativeBrowsers} from '../src/native-browser.mjs';

const testRoot=join(import.meta.dirname,'../test-results');mkdirSync(testRoot,{recursive:true});
const fresh=()=>validateProfile({name:'Chrome normal',engine:'chrome',launchMode:'plain',startURL:'https://accounts.google.com/'});

test('Plain Chrome follows the successful minimal launch without proxy, identity or automation flags',()=>{
 const p=fresh();assert.equal(p.blockWebRTC,false);
 assert.deepEqual(standardArguments(p,'actual-profile'),['--user-data-dir=actual-profile','--new-window','https://accounts.google.com/']);
 assert.deepEqual(standardArguments({...p,startupMode:'restore'},'actual-profile'),['--user-data-dir=actual-profile','--new-window','--restore-last-session']);
 assert.throws(()=>standardArguments(p,'actual-profile',['javascript:alert(1)']));
});

test('Normal and customized modes keep separate data directories for every full engine',()=>{
 const managed=validateProfile({name:'Existing',engine:'chrome'});
 assert.equal(managed.launchMode,'managed');assert.equal(managed.blockWebRTC,true);
 const dataRoot=mkdtempSync(join(testRoot,'plain-paths-')),manager=new NativeBrowsers({appRoot:dataRoot,dataRoot});
 for(const engine of ['chrome','chromium','edge']){
  const customized=validateProfile({...managed,engine}),plain=validateProfile({...customized,launchMode:'plain'},customized);
  assert.equal(plain.blockWebRTC,true);assert.equal(plain.id,customized.id);
  assert.notEqual(manager.directory(plain),manager.directory(customized));
  assert.equal(manager.directory(plain),join(dataRoot,'native-profiles',plain.id,engine+'-normal'));
  assert.equal(manager.directory(customized),join(dataRoot,'native-profiles',plain.id,engine));
  assert.deepEqual(standardArguments(plain,'direct'),['--user-data-dir=direct','--new-window','about:blank']);
 }
});

test('Normal browsing preserves routing and stored overrides without applying identity changes',()=>{
 const p=fresh();
 for(const overrides of [{proxyUser:'test'},{proxySecret:'encrypted'},{proxyPassword:'private'}])assert.throws(()=>validateProfile({...p,...overrides}),/credenciais de proxy/);
 assert.throws(()=>validateProfile({...p,engine:'embedded'}),/navegador completo/);
 assert.throws(()=>validateProfile({...p,launchMode:'invalid'}),/Modo de abertura/);
 const configured=validateProfile({...p,proxy:'http://localhost:8080',userAgent:'custom',blockWebRTC:true,privacy:{canvas:true},emulateScreen:true,timezone:'Europe/Lisbon',timezoneEnabled:true});
 assert.equal(configured.blockWebRTC,true);assert.equal(configured.privacy.canvas,true);assert.equal(configured.userAgent,'custom');
 assert.deepEqual(standardArguments(configured,'direct'),['--user-data-dir=direct','--new-window','--proxy-server=http://localhost:8080','--proxy-bypass-list=<-loopback>','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','https://accounts.google.com/']);
});

test('Legacy native profiles adopt normal browsing while retaining settings and original data',()=>{
 const dataRoot=mkdtempSync(join(testRoot,'plain-migration-')),legacy=validateProfile({name:'Legacy',engine:'edge',locale:'fr-FR',width:1500,height:900,userAgent:'custom',timezone:'Europe/Lisbon',timezoneEnabled:true,latitude:10,longitude:20,privacy:{canvas:true},proxy:'http://localhost:8080'});
 delete legacy.launchMode;
 const oldPath=join(dataRoot,'native-profiles',legacy.id,'edge');mkdirSync(oldPath,{recursive:true});writeFileSync(join(oldPath,'marker'),'original');
 writeFileSync(join(dataRoot,'workspace.json'),JSON.stringify({schema:2,profiles:[legacy],groups:[],settings:{}}));
 const store=new Store(dataRoot),loaded=store.get(legacy.id);assert.equal(loaded.launchMode,'plain');
 const edited=store.upsert({id:loaded.id,name:'Renamed',launchMode:'plain'});
 for(const key of ['locale','width','height','userAgent','timezone','timezoneEnabled','geolocation','geolocationEnabled','privacy','blockWebRTC','proxy'])assert.deepEqual(edited[key],legacy[key],key);
 const restored=store.upsert({...edited,launchMode:'managed'});assert.equal(restored.launchMode,'managed');
 assert.equal(readFileSync(join(oldPath,'marker'),'utf8'),'original');
 const manager=new NativeBrowsers({appRoot:dataRoot,dataRoot});assert.equal(manager.directory(restored),oldPath);
});

test('Store edits, duplicates and JSON/CSV round trips preserve plain mode and separate identities',()=>{
 const store=new Store(mkdtempSync(join(testRoot,'plain-store-'))),p=store.upsert({...fresh(),id:undefined});
 const edited=store.upsert({...p,name:'Renamed'});assert.equal(edited.launchMode,'plain');assert.equal(edited.id,p.id);
 const reread=new Store(store.directory).get(p.id);assert.equal(reread.launchMode,'plain');assert.equal(reread.blockWebRTC,false);
 const duplicate=store.upsert({...reread,id:undefined,name:'Copy'});assert.equal(duplicate.launchMode,'plain');assert.notEqual(duplicate.id,p.id);
 const imported=importProfileConfiguration(configurationBundle([reread]).profiles[0]);
 assert.equal(imported.launchMode,'plain');assert.notEqual(imported.id,p.id);assert.equal(imported.blockWebRTC,false);
 const fromCSV=csvImport(csvText([reread])).profiles[0];assert.equal(fromCSV.launchMode,'plain');assert.equal(fromCSV.blockWebRTC,false);assert.notEqual(fromCSV.id,p.id);
});

test('Plain launches use the actual directory, preserve their own session and isolate other profiles',async()=>{
 const dataRoot=mkdtempSync(join(testRoot,'plain-launch-')),first=fresh(),second=fresh();
 const directory=join(dataRoot,'native-profiles',first.id,'chrome');mkdirSync(directory,{recursive:true});
 let captured;
 const spawnProcess=(_file,args)=>{captured=args;const child=new EventEmitter();child.pid=12345;child.exitCode=null;queueMicrotask(()=>child.emit('spawn'));return child;};
 const options={profile:first,engine:{path:'chrome-test'},directory,launchDirectory:'must-not-use-junction',dataRoot,spawnProcess};
 const one=await launchStandardBrowser(options);
 assert.deepEqual(captured,standardArguments(first,directory));assert.equal(one.cdp,undefined);
 writeFileSync(join(directory,'session-marker'),'retained');one.child.emit('exit',0);await one.exited;
 const two=await launchStandardBrowser(options);assert.equal(readFileSync(join(directory,'session-marker'),'utf8'),'retained');two.child.emit('exit',0);await two.exited;
 const otherDirectory=join(dataRoot,'native-profiles',second.id,'chrome');mkdirSync(otherDirectory,{recursive:true});
 const three=await launchStandardBrowser({...options,profile:second,directory:otherDirectory});
 assert.ok(captured.includes('--user-data-dir='+otherDirectory));assert.equal(existsSync(join(otherDirectory,'session-marker')),false);three.child.emit('exit',0);
});

test('Plain profiles refuse session transfers and managed controls before opening or writing data',async()=>{
 const dataRoot=mkdtempSync(join(testRoot,'plain-guard-')),manager=new NativeBrowsers({appRoot:dataRoot,dataRoot}),p=fresh();
 manager.open=()=>assert.fail('Never open Chrome for a managed operation');
 manager.directory=()=>assert.fail('Never touch profile data for a managed operation');
 manager.engineVersion=()=>assert.fail('Never start an engine probe');
 for(const action of [()=>manager.use(p,()=>{}),()=>manager.cookies(p),()=>manager.importCookies(p,[]),()=>manager.exportStorage(p),()=>manager.importStorage(p,{})])await assert.rejects(action,/menus do navegador/);
 for(const action of [()=>manager.navigate(p,'https://example.com/'),()=>manager.page(p,'settings'),()=>manager.extensionStore(p)])await assert.rejects(action,/barra de endereços/);
});
