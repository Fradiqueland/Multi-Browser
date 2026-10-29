import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {validateProfile} from '../src/core.mjs';
import {standardArguments,standardSessionActive,launchStandardBrowser,CLOSE_STANDARD} from '../src/standard-browser.mjs';
import {NativeBrowsers} from '../src/native-browser.mjs';

const profile=()=>validateProfile({name:'Normal test',engine:'chrome',startupMode:'blank'});
const testRoot=join(import.meta.dirname,'../test-results');mkdirSync(testRoot,{recursive:true});
function fixture(p=profile()){
 const dataRoot=mkdtempSync(join(testRoot,'standard-')),directory=join(dataRoot,'native-profiles',p.id,p.engine);
 mkdirSync(directory,{recursive:true});
 return {profile:p,engine:{path:'test-browser'},directory,launchDirectory:directory,dataRoot,isAlive:()=>true};
}
function fakeSpawn(capture=()=>{}){
 return (file,args,options)=>{capture({file,args,options});const child=new EventEmitter();child.pid=123456;child.exitCode=null;child.kill=()=>assert.fail('Never kill a normal browser');queueMicrotask(()=>child.emit('spawn'));return child;};
}
const leaseFile=f=>join(f.dataRoot,'normal-sessions',f.profile.id+'.json');
function lease(f,value){mkdirSync(join(f.dataRoot,'normal-sessions'),{recursive:true});writeFileSync(leaseFile(f),typeof value==='string'?value:JSON.stringify(value));}

test('Normal launch preserves profile routing without automation or identity overrides',()=>{
 const p={...profile(),proxy:'http://127.0.0.1:8080',blockWebRTC:true,userAgent:'custom',locale:'fr-FR',privacy:{canvas:true}};
 const args=standardArguments(p,'profile-directory',['https://accounts.google.com/']);
 assert.ok(args.includes('--user-data-dir=profile-directory'));
 assert.ok(args.includes('--proxy-server='+p.proxy));assert.ok(args.includes('--proxy-bypass-list=<-loopback>'));
 assert.ok(args.includes('--force-webrtc-ip-handling-policy=disable_non_proxied_udp'));
 assert.ok(args.includes('https://accounts.google.com/'));
 assert.ok(!args.some(a=>/remote-debug|automation|user-agent|headless|accept-lang|--lang=/.test(a)));
 assert.ok(standardArguments({...p,proxy:'',blockWebRTC:false},'other').includes('--no-proxy-server'));
 assert.ok(standardArguments({...p,startupMode:'restore'},'other').includes('--restore-last-session'));
});
test('Unsupported engines, managed proxy credentials and unsafe URLs are refused',()=>{
 for(const engine of ['embedded','unknown'])assert.throws(()=>standardArguments({...profile(),engine},'test'));
 for(const credentials of [{proxyUser:'user'},{proxySecret:'secret'}])assert.throws(()=>standardArguments({...profile(),...credentials},'test'),/proxy/);
 assert.throws(()=>standardArguments(profile(),'test',['file:///private']));
 assert.throws(()=>standardSessionActive('test','../../outside'));
});
test('Launch uses isolated existing data and releases only its own lock after exit',async()=>{
 const f=fixture();writeFileSync(join(f.directory,'marker'),'keep');let captured,exited=0;
 const record=await launchStandardBrowser({...f,spawnProcess:fakeSpawn(c=>captured=c),onExit:()=>exited++});
 assert.equal(record.standard,true);assert.equal(record.ready,true);assert.equal(record.cdp,undefined);
 assert.deepEqual(captured.options.stdio,['ignore','ignore','ignore']);
 assert.ok(captured.args.includes('--user-data-dir='+f.directory));
 assert.equal(JSON.parse(readFileSync(leaseFile(f))).phase,'running');
 assert.equal(standardSessionActive(f.dataRoot,f.profile.id,()=>true),true);
 await assert.rejects(launchStandardBrowser({...f,spawnProcess:()=>assert.fail('duplicate spawn')}),{message:CLOSE_STANDARD});
 record.child.emit('exit',0,null);await record.exited;
 assert.equal(exited,1);assert.equal(existsSync(leaseFile(f)),false);
 assert.equal(readFileSync(join(f.directory,'marker'),'utf8'),'keep');
});
test('Inactive locks recover; incomplete or corrupt reservations fail closed',async()=>{
 const f=fixture();lease(f,{id:f.profile.id,phase:'running',pid:123456});
 assert.equal(standardSessionActive(f.dataRoot,f.profile.id,()=>false),false);
 const record=await launchStandardBrowser({...f,isAlive:()=>false,spawnProcess:fakeSpawn()});record.child.emit('exit',0);
 for(const value of ['broken',{id:f.profile.id,phase:'starting'},{id:f.profile.id,phase:'running',pid:-1}]){
  lease(f,value);assert.equal(standardSessionActive(f.dataRoot,f.profile.id,()=>false),true);
  await assert.rejects(launchStandardBrowser({...f,isAlive:()=>false,spawnProcess:()=>assert.fail('unsafe spawn')}),{message:CLOSE_STANDARD});
 }
});
test('Synchronous and asynchronous spawn failures release the reservation',async()=>{
 for(const asynchronous of [false,true]){
  const f=fixture();
  const spawnProcess=()=>{if(!asynchronous)throw Error('spawn failed');const child=new EventEmitter();queueMicrotask(()=>child.emit('error',Error('spawn failed')));return child;};
  await assert.rejects(launchStandardBrowser({...f,spawnProcess}),/spawn failed/);
  assert.equal(existsSync(leaseFile(f)),false);
 }
});
test('An old exit cannot delete a replacement reservation',async()=>{
 const f=fixture(),record=await launchStandardBrowser({...f,spawnProcess:fakeSpawn()});
 lease(f,{id:f.profile.id,phase:'running',pid:process.pid,nonce:'replacement'});
 record.child.emit('exit',0);await record.exited;
 assert.equal(JSON.parse(readFileSync(leaseFile(f))).nonce,'replacement');
});
test('A restarted manager blocks data changes and managed launches for a live normal profile',async()=>{
 const f=fixture(),manager=new NativeBrowsers({appRoot:f.dataRoot,dataRoot:f.dataRoot});
 lease(f,{id:f.profile.id,phase:'running',pid:process.pid});
 assert.equal(manager.has(f.profile.id),true);assert.equal(manager.isStandard(f.profile.id),true);
 await assert.rejects(manager.open(f.profile),{message:CLOSE_STANDARD});
 await assert.rejects(manager.stop(f.profile.id),{message:CLOSE_STANDARD});
 await assert.rejects(manager.use(f.profile,()=>assert.fail('unsafe data access')));
 assert.throws(()=>manager.removeData(f.profile));assert.equal(existsSync(f.directory),true);
});
test('Normal windows must close themselves and never use CDP navigation',async()=>{
 const f=fixture(),manager=new NativeBrowsers({appRoot:f.dataRoot,dataRoot:f.dataRoot});
 const record=await launchStandardBrowser({...f,spawnProcess:fakeSpawn()});manager.records.set(f.profile.id,record);
 await assert.rejects(manager.stop(f.profile.id),{message:CLOSE_STANDARD});
 await assert.rejects(manager.navigateRecord(record,'https://example.com/'),/barra de/);
 assert.equal(record.closing,null);record.child.emit('exit',0);
});
