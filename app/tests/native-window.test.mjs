import {NativeBrowsers} from '../src/native-browser.mjs';
import {validateProfile} from '../src/core.mjs';
import {bounded,until,closeHTTPServer} from '../src/operations.mjs';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),directory=mkdtempSync(join(root,'test-results','native-window-')),manager=new NativeBrowsers({appRoot:root,dataRoot:directory}),tests=[];
const check=(name,value)=>{assert.ok(value,name);tests.push({name,ok:true});};
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Native window fixture</title><h1>Local window</h1>');});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const url='http://127.0.0.1:'+server.address().port+'/',profile=validateProfile({name:'Janela nativa de teste',engine:'chromium',locale:'pt-PT',startupPages:[url]});let report,record;
try{
 record=await manager.open(profile,{headless:false});const first=[...record.targets.values()].find(t=>t.type==='page'),window=await record.cdp.send('Browser.getWindowForTarget',{targetId:first.targetId});
 check('Chromium incluido abre uma janela Windows normal',Number.isInteger(window.windowId)&&window.bounds.width>0&&!record.child.spawnargs.some(a=>a.startsWith('--headless')));
 const second=await manager.navigate(profile,url+'second'),secondWindow=await record.cdp.send('Browser.getWindowForTarget',{targetId:second.targetId});
 check('Novo separador usa a mesma janela nativa',secondWindow.windowId===window.windowId);
 await until(async()=>{const r=await record.cdp.send('Runtime.evaluate',{expression:"location.href==="+JSON.stringify(url+'second')+"&&document.querySelector('h1')?.textContent==='Local window'&&navigator.language==='pt-PT'&&typeof require==='undefined'&&typeof window.desktop==='undefined'",returnByValue:true},second.sessionId);return r.result?.value===true;},'documento da janela nativa',15000);
 check('Documento real conserva identidade e ausencia de Node e IPC',true);
 await record.cdp.send('Target.closeTarget',{targetId:first.targetId});const targets=await record.cdp.send('Target.getTargets');check('Fechar um separador conserva o outro',targets.targetInfos.some(t=>t.targetId===second.targetId)&&record.child.exitCode===null);
 await record.cdp.send('Target.closeTarget',{targetId:second.targetId});const exit=await bounded(record.exited,'fechar ultima janela nativa',15000);check('Fechar a ultima janela termina normalmente o processo',exit.code===0);report={ok:true,tests,version:record.version.product};
}catch(error){report={ok:false,tests,error:error.stack||String(error),diagnostics:{pid:record?.child.pid,exitCode:record?.child.exitCode,pipeClosed:record?.cdp.closed,targets:record?[...record.targets.values()].map(t=>({id:t.targetId,type:t.type,url:t.url})):[]}};if(record&&!record.cdp.closed)try{report.diagnostics.liveTargets=(await record.cdp.send('Target.getTargets')).targetInfos.map(t=>({id:t.targetId,type:t.type,url:t.url}));}catch(e){report.diagnostics.protocolError=e.message;}}
finally{const results=await Promise.allSettled([manager.stopAll(),closeHTTPServer(server)]);const failure=results.find(r=>r.status==='rejected');if(failure){report.ok=false;report.cleanupError=String(failure.reason);if(record?.child.exitCode===null){record.child.kill();await bounded(record.exited,'terminar janela de teste bloqueada',5000).catch(()=>{});}}writeFileSync(join(directory,'window-result.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({ok:report.ok,checks:tests.length,directory,error:report.error,cleanupError:report.cleanupError,diagnostics:report.diagnostics}));if(!report.ok)process.exitCode=1;
