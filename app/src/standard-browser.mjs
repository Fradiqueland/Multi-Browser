import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {safeURL,startupURLs,assertPlainProfile} from './core.mjs';

export const CLOSE_STANDARD='Feche este perfil na janela do navegador antes de continuar.';
const validId=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
function leasePath(root,id){if(!validId(id))throw Error('Invalid profile identifier.');return join(root,'normal-sessions',id+'.json');}
function alive(pid){try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}}
function readLease(file){try{return JSON.parse(readFileSync(file,'utf8'));}catch{return null;}}
export function standardSessionActive(root,id,isAlive=alive){
 const file=leasePath(root,id);if(!existsSync(file))return false;
 const lease=readLease(file);
 // Incomplete/corrupt reservations fail closed. Never risk editing a live profile.
 if(!lease||lease.id!==id||lease.phase!=='running'||!Number.isSafeInteger(lease.pid)||lease.pid<=0)return true;
 return isAlive(lease.pid);
}
export function standardArguments(profile,directory,urls=startupURLs(profile)){
 if(profile.launchMode==='plain'){
  assertPlainProfile(profile);
  const args=['--user-data-dir='+directory,'--new-window'];
  // Keep explicit profile routing; an empty proxy uses the browser/system route,
  // matching the successful clean-profile test. Never expose credentials in flags.
  if(profile.proxy)args.push('--proxy-server='+profile.proxy,'--proxy-bypass-list=<-loopback>');
  if(profile.proxy&&profile.blockWebRTC)args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
  if(profile.startupMode==='restore')return [...args,'--restore-last-session'];
  return [...args,...(urls.length?urls:['about:blank']).map(safeURL)];
 }
 if(!['chromium','chrome','edge'].includes(profile.engine))throw Error('Selecione um navegador completo para o modo normal.');
 if(profile.proxyUser||profile.proxySecret)throw Error('O modo normal não suporta credenciais de proxy geridas pela aplicação.');
 const args=['--user-data-dir='+directory,'--no-first-run','--no-default-browser-check','--disable-background-mode','--window-size='+profile.width+','+profile.height];
 // Preserve routing and the configured UDP restriction. Never silently bypass a proxy.
 if(profile.proxy)args.push('--proxy-server='+profile.proxy,'--proxy-bypass-list=<-loopback>');
 else args.push('--no-proxy-server');
 if(profile.blockWebRTC)args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
 if(profile.startupMode==='restore')args.push('--restore-last-session');
 else args.push(...(urls.length?urls:['about:blank']).map(safeURL));
 return args;
}

export async function launchStandardBrowser({profile,engine,directory,launchDirectory,dataRoot,onExit=()=>{},spawnProcess=spawn,isAlive=alive}){
 const args=standardArguments(profile,profile.launchMode==='plain'?directory:launchDirectory),file=leasePath(dataRoot,profile.id);
 mkdirSync(join(dataRoot,'normal-sessions'),{recursive:true});
 if(standardSessionActive(dataRoot,profile.id,isAlive))throw Error(CLOSE_STANDARD);
 if(existsSync(file))unlinkSync(file); // A validated, no-longer-running lease only.
 const nonce=randomUUID(),lease={id:profile.id,nonce,phase:'starting',managerPid:process.pid};
 writeFileSync(file,JSON.stringify(lease),{flag:'wx',mode:0o600});
 const release=()=>{if(readLease(file)?.nonce===nonce)unlinkSync(file);};
 let child;
 try{
  child=spawnProcess(engine.path,args,{windowsHide:false,stdio:['ignore','ignore','ignore']});
 }catch(error){release();throw error;}
 const record={profile,engine,directory,child,standard:true,ready:false,closing:null,targets:new Map(),sessions:new Map()};
 let settle;
 record.exited=new Promise(resolve=>settle=resolve);
 let finished=false;
 const finish=result=>{if(finished)return;finished=true;try{release();}catch(error){result.cleanupError=error;}settle(result);onExit(record,result);};
 child.once('exit',(code,signal)=>finish({code,signal}));child.once('error',error=>finish({error}));
 try{
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  if(finished||!Number.isSafeInteger(child.pid)||child.pid<=0)throw Error('Normal browser did not start.');
  const temporary=file+'.'+nonce+'.tmp';
  writeFileSync(temporary,JSON.stringify({...lease,phase:'running',pid:child.pid}),{flag:'wx',mode:0o600});renameSync(temporary,file);
  record.ready=true;return record;
 }catch(error){
  // A started process may still own the profile: retain the conservative lease.
  if(finished||!child.pid)release();
  throw error;
 }
}
