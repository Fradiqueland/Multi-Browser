import {mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {NativeBrowsers} from '../src/native-browser.mjs';
import {validateProfile} from '../src/core.mjs';
const appRoot=resolve(import.meta.dirname,'..'),dataRoot=mkdtempSync(join(appRoot,'test-results','ten-profiles-')),errors=[],checks=[];
const manager=new NativeBrowsers({appRoot,dataRoot,error:e=>errors.push(e.message)}),engine=manager.available()[0];
if(!engine)throw Error('Motor completo indisponivel.');
const records=[],started=performance.now();let report;
try{
 for(let i=0;i<10;i++){
  const p=validateProfile({name:'Carga '+i,engine:engine.id,startupMode:'blank',locale:i%2?'pt-PT':'en-US',timezone:i%2?'Europe/Lisbon':'America/New_York'});
  records.push(await manager.open(p,{headless:true}));console.log('Perfil '+(i+1)+'/10 pronto');
 }
 assert.equal(manager.records.size,10);assert.equal(new Set(records.map(r=>r.directory)).size,10);checks.push({name:'Dez navegadores simultaneos com pastas independentes',ok:true});
 for(const record of records){
  assert.equal(record.child.exitCode,null);
  const target=[...record.targets.values()].find(t=>t.type==='page');
  const response=await record.cdp.send('Runtime.evaluate',{expression:'JSON.stringify({language:navigator.language,zone:Intl.DateTimeFormat().resolvedOptions().timeZone,node:typeof require})',returnByValue:true},target.sessionId);
  const identity=JSON.parse(response.result.value);assert.equal(identity.language,record.profile.locale);assert.equal(identity.zone,record.profile.timezone);assert.equal(identity.node,'undefined');
  checks.push({name:'Identidade isolada do perfil '+record.profile.name,ok:true});
 }
 assert.equal(errors.length,0);checks.push({name:'Sem falhas de configuracao durante a carga',ok:true});
 report={ok:true,engine:engine.id,readyMilliseconds:Math.round(performance.now()-started),tests:checks};
}catch(error){report={ok:false,tests:checks,error:error.stack||String(error)};}
finally{
 try{await manager.stopAll();assert.ok((await Promise.all(records.map(r=>r.exited))).every(exit=>exit.code===0));checks.push({name:'Dez processos encerram normalmente com codigo zero',ok:true});}
 catch(error){report.ok=false;report.cleanupError=error.message;}
 writeFileSync(join(dataRoot,'load-result.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({ok:report.ok,checks:checks.length,directory:dataRoot,readyMilliseconds:report.readyMilliseconds,error:report.error,cleanupError:report.cleanupError}));if(!report.ok)process.exitCode=1;
