import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {mkdirSync,lstatSync,realpathSync,symlinkSync} from 'node:fs';
// Chromium CacheStorage still rejects deep Win32 paths. A stable junction keeps
// every byte in the portable profile while supplying a short, ordinary path.
// Its stable identity also preserves Chromium's own single-profile locking.
export function nativeLaunchDirectory(directory){
 if(process.platform!=='win32')return directory;
 const actual=realpathSync(directory),root=join(tmpdir(),'multi-browser-paths');
 mkdirSync(root,{recursive:true});
 if(lstatSync(root).isSymbolicLink())throw Error('A pasta temporaria dos perfis nao pode ser uma ligacao.');
 const alias=join(root,createHash('sha256').update(actual.toLowerCase()).digest('hex').slice(0,24));
 try{symlinkSync(actual,alias,'junction');}catch(error){if(error.code!=='EEXIST')throw error;}
 if(!lstatSync(alias).isSymbolicLink()||realpathSync(alias).toLowerCase()!==actual.toLowerCase())throw Error('A ligacao temporaria do perfil nao corresponde a pasta autorizada.');
 // Reuse this link across launches. Removing it on exit could race another
 // manager opening the same profile. It contains no copy of the user's data.
 return resolve(alias);
}
