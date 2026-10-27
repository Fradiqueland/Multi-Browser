import {createWriteStream,createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,stat,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
const root=resolve(import.meta.dirname,'..'),cache=join(root,'.runtime','downloads');
const electronVersion='44.9.3';
const targets={x64:{platform:'Mac',revision:'1726619'},arm64:{platform:'Mac_Arm',revision:'1726621'}};
async function checksum(file,algorithm='sha256'){const h=createHash(algorithm);for await(const chunk of createReadStream(file))h.update(chunk);return h.digest(algorithm==='md5'?'base64':'hex');}
async function download(url,name,{sha256,md5}={}){
 const destination=join(cache,name);
 let present=false;try{present=(await stat(destination)).isFile();}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!present){
  console.log('Downloading '+name);
  const response=await fetch(url,{signal:AbortSignal.timeout(300000)});if(!response.ok)throw Error('Download failed: '+response.status+' '+url);
  const temporary=destination+'.partial-'+randomUUID();
  await pipeline(response.body,createWriteStream(temporary,{flags:'wx'}));
  if(sha256&&await checksum(temporary)!==sha256)throw Error('SHA256 mismatch: '+name);
  if(md5&&await checksum(temporary,'md5')!==md5)throw Error('Upstream MD5 mismatch: '+name);
  await rename(temporary,destination);
 }
 const actual=await checksum(destination);
 if(sha256&&actual!==sha256)throw Error('Cached SHA256 mismatch: '+name);
 if(md5&&await checksum(destination,'md5')!==md5)throw Error('Cached MD5 mismatch: '+name);
 return {file:name,url,sha256:actual,bytes:(await stat(destination)).size};
}
await mkdir(cache,{recursive:true});
const base='https://github.com/electron/electron/releases/download/v'+electronVersion;
const sumsResponse=await fetch(base+'/SHASUMS256.txt',{signal:AbortSignal.timeout(30000)});if(!sumsResponse.ok)throw Error('Official Electron checksums unavailable');
const sums=await sumsResponse.text();
for(const [arch,target] of Object.entries(targets)){
 const electronName='electron-v'+electronVersion+'-darwin-'+arch+'.zip';
 const checksumLine=sums.split(/\r?\n/).find(line=>line.trim().endsWith(' '+electronName)||line.trim().endsWith('*'+electronName));
 const expected=checksumLine?.split(/\s+/)[0];if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('Invalid Electron checksum');
 const chromiumURL='https://commondatastorage.googleapis.com/chromium-browser-snapshots/'+target.platform+'/'+target.revision+'/chrome-mac.zip';
 const head=await fetch(chromiumURL,{method:'HEAD',signal:AbortSignal.timeout(30000)});if(!head.ok)throw Error('Chromium archive unavailable');
 const md5=head.headers.get('x-goog-hash')?.match(/(?:^|,\s*)md5=([^,]+)/)?.[1];if(!md5)throw Error('Chromium transport checksum unavailable');
 const [electron,chromium]=await Promise.all([download(base+'/'+electronName,electronName,{sha256:expected}),download(chromiumURL,'chromium-darwin-'+arch+'-'+target.revision+'.zip',{md5})]);
 const manifest={platform:'darwin',arch,electron:{...electron,version:electronVersion},chromium:{...chromium,...target,transportMD5:md5},executionVerified:false};
 const manifestPath=join(cache,'darwin-'+arch+'-runtime.json');
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');console.log('MAC_RUNTIME_VERIFIED: '+arch);
}
