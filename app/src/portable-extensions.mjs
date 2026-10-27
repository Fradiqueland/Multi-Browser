import {mkdirSync,lstatSync,realpathSync,readdirSync,readFileSync,writeFileSync,copyFileSync,existsSync,rmSync} from 'node:fs';
import {join,resolve,relative,isAbsolute,dirname} from 'node:path';
import {randomUUID,generateKeyPairSync,createHash,createPublicKey} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function inside(base,target){const rel=relative(base,target);return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);}
function managedPath(dataRoot,profileId,directory){
 if(!uuid.test(profileId)||!uuid.test(directory))throw Error('Invalid managed extension identifier.');
 const base=resolve(dataRoot),target=join(base,'extensions',profileId,directory);
 for(const p of [join(base,'extensions'),join(base,'extensions',profileId),target])if(existsSync(p)){
  if(lstatSync(p).isSymbolicLink()||!inside(realpathSync(base),realpathSync(p)))throw Error('External extension path refused.');
 }
 return target;
}
export function extensionPath(dataRoot,profileId,extension){
 // Existing external extensions remain compatible; new installations use relative identifiers.
 return extension.directory?managedPath(dataRoot,profileId,extension.directory):extension.path;
}
export function installPortableExtension(dataRoot,profileId,source){
 const origin=resolve(source),files=[];let bytes=0,directories=0;
 function scan(directory,depth=0){
  if(++directories>10000||depth>64)throw Error('Extension directory limit exceeded.');
  if(lstatSync(directory).isSymbolicLink())throw Error('Extension links are not supported.');
  for(const name of readdirSync(directory)){
   const path=join(directory,name),stat=lstatSync(path);
   if(stat.isSymbolicLink())throw Error('Extension links are not supported.');
   if(stat.isDirectory())scan(path,depth+1);
   else if(stat.isFile()){bytes+=stat.size;if(bytes>256*1024*1024||files.length>=10000)throw Error('Extension exceeds 256 MiB or 10000 files.');files.push({path,name:relative(origin,path)});}
   else throw Error('Unsupported extension file.');
  }
 }
 scan(origin);const manifestPath=join(origin,'manifest.json');
 if(!existsSync(manifestPath)||lstatSync(manifestPath).size>1024*1024)throw Error('Invalid extension manifest.');
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8').replace(/^﻿/,''));
 if(![2,3].includes(manifest.manifest_version)||typeof manifest.name!=='string'||!manifest.name||typeof manifest.version!=='string')throw Error('Invalid extension manifest.');
 // A public key stabilizes the extension ID when the portable directory moves.
 // No private key is retained, and an author's existing key is never replaced.
 if(!manifest.key)manifest.key=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({type:'spki',format:'der'}).toString('base64');
 if(typeof manifest.key!=='string')throw Error('Invalid extension key.');
 const key=Buffer.from(manifest.key,'base64');createPublicKey({key,type:'spki',format:'der'});
 const id=createHash('sha256').update(key).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 const directory=randomUUID(),target=managedPath(dataRoot,profileId,directory);
 mkdirSync(target,{recursive:true});
 try{for(const file of files){const output=join(target,file.name);mkdirSync(dirname(output),{recursive:true});copyFileSync(file.path,output);}writeFileSync(join(target,'manifest.json'),JSON.stringify(manifest,null,2));}
 catch(error){removePortableExtension(dataRoot,profileId,{directory});throw error;}
 return {id,directory,path:target};
}
export function removePortableExtension(dataRoot,profileId,extension){
 if(!extension.directory)return;const target=managedPath(dataRoot,profileId,extension.directory);
 if(existsSync(target))rmSync(target,{recursive:true,force:false,maxRetries:2});
}
