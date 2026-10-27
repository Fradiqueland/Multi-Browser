import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Store,validateProfile,safeURL,proxyConfig,encryptBundle,decryptBundle,configurationBundle,cookieForImport} from '../src/core.mjs';
test('URLs perigosos e credenciais embutidas são recusados',()=>{
 for(const url of ['file:///C:/Windows/win.ini','javascript:alert(1)','data:text/html,x','https://user:secret@example.com'])assert.throws(()=>safeURL(url));
 assert.equal(safeURL('example.com'),'https://example.com/');assert.match(safeURL('pesquisa de exemplo'),/^https:\/\/www.google.com\/search/);
});
test('Proxy, coordenadas, fuso e janela são validados',()=>{
 assert.equal(proxyConfig('socks5://127.0.0.1:1080'),'socks5://127.0.0.1:1080');
 for(const proxy of ['file:///etc/passwd','http://user:secret@localhost:80','http://example.com/path'])assert.throws(()=>proxyConfig(proxy));
 assert.throws(()=>validateProfile({name:'A',timezone:'Invalid/time'}));assert.throws(()=>validateProfile({name:'A',latitude:200,longitude:0}));
 assert.throws(()=>validateProfile({name:'A',width:10}));assert.throws(()=>validateProfile({name:'A',proxy:'socks5://localhost:1080',proxyUser:'u'}));
});
test('Identidade, persistência, backups e eliminação isolada',()=>{
 const dir=mkdtempSync(join(import.meta.dirname,'store-')),store=new Store(dir),a=store.upsert({name:'A'}),b=store.upsert({name:'B'});
 assert.notEqual(a.id,b.id);assert.equal(store.upsert({...a,name:'Renomeado'}).id,a.id);
 store.history(a.id,'https://a.example/','A');store.history(b.id,'https://b.example/','B');store.remove(a.id);
 const reload=new Store(dir);assert.equal(reload.state.profiles.length,1);assert.equal(reload.state.history[0].profileId,b.id);
 assert.doesNotThrow(()=>JSON.parse(readFileSync(join(dir,'workspace.json.backup'),'utf8')));
});
test('Exportação exclui segredos e caminhos de extensões',()=>{
 const p=validateProfile({name:'A'});p.proxySecret='secret';p.busy=true;p.running=true;p.hasProxyPassword=true;p.extensions=[{path:'C:/private'}];const out=configurationBundle([p]).profiles[0];
 for(const key of ['id','proxySecret','extensions','busy','running','hasProxyPassword'])assert.equal(out[key],undefined);
});
test('Encriptação autentica conteúdo e recusa adulteração',()=>{
 const value={cookies:[{value:'sensitive'}]},password='palavra-passe-segura',encrypted=encryptBundle(value,password);
 assert.ok(!encrypted.includes('sensitive'));assert.deepEqual(decryptBundle(encrypted,password),value);
 assert.throws(()=>decryptBundle(encrypted,'incorreta'));const b=JSON.parse(encrypted);b.data='AAAA';assert.throws(()=>decryptBundle(JSON.stringify(b),password));assert.throws(()=>encryptBundle(value,'curta'));
});
test('Importação de cookies usa uma lista explícita de campos',()=>{
 const c=cookieForImport({name:'id',value:'1',domain:'.example.com',path:'/',secure:true,untrusted:'x'});
 assert.equal(c.url,'https://example.com/');assert.equal(c.untrusted,undefined);assert.throws(()=>cookieForImport({name:'x',value:'y',domain:'example.com/path'}));
});


test('Operacoes assincronas pendentes terminam com diagnostico',async()=>{
 const {bounded}=await import('../src/operations.mjs');
 await assert.rejects(bounded(new Promise(()=>{}),'operacao bloqueada',25),/Tempo limite: operacao bloqueada/);
 assert.equal(await bounded(Promise.resolve('ok'),'operacao normal',100),'ok');
 await assert.rejects(bounded(Promise.reject(new Error('erro nativo')),'operacao com erro',100),/erro nativo/);
});

test('CSV suporta aspas, virgulas, novas linhas e BOM',async()=>{
 const {parseCSV,csvText,csvProfile}=await import('../src/workspace.mjs');
 const original=validateProfile({name:'Cliente, "Norte"',notes:'Linha 1\nLinha 2',group:'Trabalho',timezone:'Europe/Lisbon',privacy:{canvas:true,webgl:true},emulateScreen:true,latitude:-23.5,longitude:-46.6});
 const csv=csvText([original]),rows=parseCSV(csv),copy=csvProfile(rows[0]);
 assert.equal(copy.name,original.name);assert.equal(copy.notes,original.notes);assert.equal(copy.timezone,original.timezone);assert.equal(copy.privacy.canvas,true);assert.equal(copy.emulateScreen,true);assert.equal(copy.geolocation.latitude,-23.5);
 assert.throws(()=>parseCSV('name,name\na,b'));assert.throws(()=>parseCSV('name,proxy\nA'));assert.throws(()=>parseCSV('name\n"nao termina'));
});
test('CSV nao exporta palavras-passe e neutraliza formulas',async()=>{
 const {parseCSV,csvText}=await import('../src/workspace.mjs');
 const p=validateProfile({name:'=HYPERLINK("https://example.com")'});p.proxySecret='segredo';const csv=csvText([p]);
 assert.ok(!csv.includes('segredo'));assert.ok(parseCSV(csv)[0].name.startsWith("'="));
});
test('Grupos podem ser descritos e renomeados sem perder perfis',async()=>{
 const {saveGroup,selectedProfiles}=await import('../src/workspace.mjs');
 const store=new Store(mkdtempSync(join(import.meta.dirname,'store-'))),a=store.upsert({name:'A',group:'Trabalho'});
 saveGroup(store,{previous:'Trabalho',name:'Projeto Norte',description:'Cliente de teste'});
 assert.equal(store.get(a.id).group,'Projeto Norte');assert.equal(store.state.groupDetails['Projeto Norte'].description,'Cliente de teste');
 assert.throws(()=>saveGroup(store,{name:'Projeto Norte'}));assert.throws(()=>selectedProfiles(store,[a.id,a.id]));assert.throws(()=>selectedProfiles(store,['inexistente']));assert.equal(selectedProfiles(store,[a.id])[0].id,a.id);
});
test('Paginacao e filtros respeitam fixacao, pesquisa e datas',async()=>{
 const {profilePage}=await import('../src/query.mjs');
 const profiles=Array.from({length:30},(_,i)=>({...validateProfile({name:'Perfil '+i,group:i%2?'Trabalho':'Pessoal'}),pinned:i===0,running:i%3===0,lastOpened:i===7?'2026-10-24':null}));
 assert.equal(profilePage(profiles,{pageSize:10,page:2}).items.length,10);assert.equal(profilePage(profiles).items[0].id,profiles[0].id);
 const page=profilePage(profiles,{group:'Trabalho',status:'running',page:99});assert.equal(page.page,1);assert.ok(page.items.every(p=>p.group==='Trabalho'&&p.running));
 assert.equal(profilePage(profiles,{query:'perfil 29'}).total,1);
 assert.equal(profilePage(profiles,{query:'nao existe',page:99}).page,1);
});
test('Restricoes de privacidade bloqueiam APIs selecionadas sem Node ou IPC',async()=>{
 const {createRequire}=await import('node:module');const {runInNewContext}=await import('node:vm');const {installPrivacy}=createRequire(import.meta.url)('../src/privacy.cjs');
 const context={DOMException,HTMLCanvasElement:class {getContext(type){return type;}toDataURL(){return 'normal';}},CanvasRenderingContext2D:class {getImageData(){return 'pixels';}},AudioContext:class {},RTCPeerConnection:class {},FontFaceSet:class {check(){return true;}}};
 runInNewContext('('+installPrivacy.toString()+')({canvas:true,webgl:true,audio:true,webrtc:true,fonts:true})',context);
 assert.equal(new context.HTMLCanvasElement().getContext('webgl'),null);
 assert.equal(new context.HTMLCanvasElement().getContext('2d'),'2d');
 assert.throws(()=>new context.HTMLCanvasElement().toDataURL(),/desativado/);
 assert.throws(()=>new context.AudioContext(),/desativado/);assert.throws(()=>new context.RTCPeerConnection(),/desativado/);
 assert.equal(new context.FontFaceSet().check('12px serif'),false);assert.equal(context.require,undefined);assert.equal(context.desktop,undefined);
});

test('Importacao de CSV Logii distingue WebRTC de fuga de IP e protege credenciais',async()=>{
 const {parseCSV,csvProfile,takeCSVPassword}=await import('../src/workspace.mjs');
 const rows=parseCSV('name,proxy,disableWebrtc,disableWebRTC,applyTimeZone,timeZone,changeResolution,resolutionWidth,resolutionHeight\nPerfil legado,127.0.0.1:8080:user:password-do-teste,1,true,true,GMT Standard Time (Europe/Lisbon),true,500,500');
 const p=csvProfile(rows[0]);assert.equal(p.timezone,'Europe/Lisbon');assert.equal(p.blockWebRTC,true);assert.equal(p.privacy.webrtc,true);assert.equal(p.width,500);
 assert.equal(p.proxy,'http://127.0.0.1:8080');assert.equal(p.proxyUser,'user');assert.ok(!JSON.stringify(p).includes('password-do-teste'));assert.equal(takeCSVPassword(p),'password-do-teste');assert.equal(takeCSVPassword(p),undefined);
 const inactive=csvProfile({name:'Sem localizacao',disableGeoLocation:'false',latitude:'10',longitude:'20'});assert.equal(inactive.geolocationEnabled,false);assert.equal(inactive.geolocation.latitude,10);
});


test('Arranque restaura separadores sem exportar historico privado',async()=>{
 const {startupURLs}=await import('../src/core.mjs');
 const p=validateProfile({name:'Arranque',startupPages:'https://one.example/\nhttps://two.example/',startupMode:'pages'});
 assert.deepEqual(startupURLs(p),['https://one.example/','https://two.example/']);
 const resumed=validateProfile({...p,startupMode:'restore'},{...p,lastTabs:['https://private.example/?token=private']});
 assert.deepEqual(startupURLs(resumed),['https://private.example/?token=private']);
 assert.ok(!JSON.stringify(configurationBundle([resumed])).includes('private.example'));
 assert.deepEqual(startupURLs({...resumed,startupMode:'blank'}),['about:blank']);
 assert.throws(()=>validateProfile({name:'Bad',startupPages:['file:///C:/private']}));
 assert.throws(()=>validateProfile({name:'Bad',startupPages:Array(11).fill('https://a.example/')}));
 assert.throws(()=>validateProfile({name:'Bad',latitude:'',longitude:1}));
});
test('Limpeza seletiva valida categorias e periodo sem expandir o ambito',async()=>{
 const {clearPlan}=await import('../src/core.mjs');
 const now=1800000000000,history=clearPlan({history:true,hours:24},now);
 assert.equal(history.since,now-86400000);assert.deepEqual(history.dataTypes,[]);
 const sites=clearPlan({siteData:true,hours:0},now);assert.ok(sites.dataTypes.includes('indexedDB'));assert.equal(sites.history,false);
 assert.deepEqual(clearPlan({cache:true}).dataTypes,['cache']);
 assert.throws(()=>clearPlan({}));assert.throws(()=>clearPlan({history:true,hours:-1}));
});

test('Alterar ou esquecer proxy nao reutiliza credenciais antigas',()=>{
 const original=validateProfile({name:'Proxy',proxy:'http://old.example:8080'});original.proxySecret='cifra-do-sistema';
 assert.equal(validateProfile({...original,name:'Mesmo'},original).proxySecret,'cifra-do-sistema');
 assert.equal(validateProfile({...original,proxy:'socks5://new.example:1080',proxyUser:''},original).proxySecret,'');
 assert.equal(validateProfile({...original,proxyPassword:null},original).proxySecret,'');
 const store=new Store(mkdtempSync(join(import.meta.dirname,'store-'))),p=store.upsert({name:'Transferencia'});
 store.state.downloads.push({id:'d',profileId:p.id,path:'C:/fixture/download.txt'});store.remove(p.id);assert.deepEqual(store.state.downloads,[]);
});

test('Fecho assincrono confirma libertacao antes de permitir alteracoes',async()=>{
 const {EventEmitter}=await import('node:events');const {closeWindow}=await import('../src/operations.mjs');
 class TestWindow extends EventEmitter {
  destroyed=false;closeRequested=false;closeCalls=0;
  isDestroyed(){return this.destroyed;}
  close(){this.closeCalls++;this.closeRequested=true;}
  finish(){this.destroyed=true;this.emit('closed');}
 }
 const window=new TestWindow();let running=true,resolved=false;
 window.once('closed',()=>{running=false;});
 const closing=closeWindow(window,'fechar perfil de teste',1000).then(()=>{resolved=true;assert.equal(running,false);});
 assert.equal(window.closeRequested,true);assert.equal(running,true);assert.equal(resolved,false);
 window.finish();await closing;assert.equal(window.listenerCount('closed'),0);
 await closeWindow(window);assert.equal(window.closeCalls,1);
 const vetoed=new TestWindow();await assert.rejects(closeWindow(vetoed,'fecho recusado',20),/Tempo limite: fecho recusado/);
 assert.equal(vetoed.isDestroyed(),false);assert.equal(vetoed.listenerCount('closed'),0);
 const immediate=new TestWindow();immediate.close=()=>immediate.finish();await closeWindow(immediate);
 const broken=new TestWindow();broken.close=()=>{throw Error('erro ao fechar');};
 await assert.rejects(closeWindow(broken),/erro ao fechar/);assert.equal(broken.listenerCount('closed'),0);
});

test('Motor de navegador valida escolhas e conserva perfis antigos',async()=>{
 const {csvText,csvProfile,parseCSV}=await import('../src/workspace.mjs');
 assert.equal(validateProfile({name:'Legado'}).engine,'embedded');
 const p=validateProfile({name:'Completo',engine:'chrome'});
 assert.equal(validateProfile({...p,name:'Editado'},p).engine,'chrome');
 assert.equal(csvProfile(parseCSV(csvText([p]))[0]).engine,'chrome');
 assert.equal(configurationBundle([p]).profiles[0].engine,'chrome');
 for(const engine of ['file:///browser.exe','../../outside','unknown'])assert.throws(()=>validateProfile({name:'X',engine}));
 const {nativePage}=await import('../src/native-browser.mjs');
 assert.equal(nativePage('chrome','extensions'),'chrome://extensions/');
 assert.throws(()=>nativePage('chrome','settings/../../outside'));
});

test('Partilha de armazenamento exclui passwords e recusa caminhos maliciosos',async()=>{
 const {mkdirSync,writeFileSync,existsSync}=await import('node:fs');
 const {gzipSync}=await import('node:zlib');
 const {exportSiteStorage,importSiteStorage}=await import('../src/site-storage.mjs');
 const source=mkdtempSync(join(import.meta.dirname,'store-'));
 mkdirSync(join(source,'Default','Local Storage','leveldb'),{recursive:true});
 writeFileSync(join(source,'Default','Local Storage','leveldb','data.ldb'),'site-data');
 writeFileSync(join(source,'Default','Login Data'),'passwords-excluded');writeFileSync(join(source,'Last Version'),'155.0.0.0');
 const snapshot=await exportSiteStorage(source,'chrome'),target=mkdtempSync(join(import.meta.dirname,'store-'));
 await importSiteStorage(target,snapshot,'chrome','Chrome/155.0.1.0');
 assert.equal(readFileSync(join(target,'Default','Local Storage','leveldb','data.ldb'),'utf8'),'site-data');assert.equal(existsSync(join(target,'Default','Login Data')),false);
 await assert.rejects(importSiteStorage(mkdtempSync(join(import.meta.dirname,'store-')),snapshot,'edge','Chrome/155.0.0.0'));
 await assert.rejects(importSiteStorage(mkdtempSync(join(import.meta.dirname,'store-')),snapshot,'chrome','Chrome/154.0.0.0'));
 for(const path of ['Default/IndexedDB/../../Login Data','Default/IndexedDB/C:outside','Default/IndexedDB/CON','Default/Preferences']){
  const directory=mkdtempSync(join(import.meta.dirname,'store-'));
  const bad={...snapshot,data:gzipSync(JSON.stringify({files:[{path:'Default/IndexedDB/first.ldb',bytes:Buffer.from('first').toString('base64')},{path,bytes:''}]})).toString('base64')};
  await assert.rejects(importSiteStorage(directory,bad,'chrome','Chrome/155.0.0.0'));
  assert.equal(existsSync(join(directory,'Default')),false);
 }
});

test('Ordenacao bidirecional conserva fixacao e limita paginas fracionarias',async()=>{
 const {profilePage,normalizeSearch}=await import('../src/query.mjs');
 const a=validateProfile({name:'Alfa',group:'Z',engine:'embedded'}),b=validateProfile({name:'Beta',group:'A'});a.createdAt='2020-01-01';b.createdAt='2021-01-01';a.running=false;b.running=true;
 assert.equal(profilePage([b,a],{sort:'name'}).items[0].id,a.id);assert.equal(profilePage([a,b],{sort:'name-desc'}).items[0].id,b.id);
 assert.equal(profilePage([a,b],{sort:'old'}).items[0].id,a.id);assert.equal(profilePage([a,b],{sort:'group'}).items[0].id,b.id);assert.equal(profilePage([a,b],{sort:'group-desc'}).items[0].id,a.id);
 assert.equal(profilePage([a,b],{sort:'status'}).items[0].id,b.id);a.pinned=true;assert.equal(profilePage([a,b],{sort:'status'}).items[0].id,a.id);
 assert.equal(profilePage(Array.from({length:25},(_,i)=>({...a,id:String(i)})),{page:1.9}).page,1);
 assert.equal(normalizeSearch('Café Déjà'),'cafe deja');
});
test('Idiomas da interface sao independentes dos dados dos perfis',async()=>{
 const {t,setLanguage,validLanguage,f}=await import('../ui/i18n.mjs');
 for(const [language,label] of [['en','Browser profiles'],['es','Perfiles del navegador'],['fr','Profils du navigateur'],['it','Profili del browser']]){setLanguage(language);assert.equal(t('Perfis de navegação'),label);assert.match(f('{n} perfis',{n:3}),/^3 /);}
 assert.equal(validLanguage('unknown'),false);setLanguage('pt-PT');assert.equal(t('Definições'),'Definições');
 const dir=mkdtempSync(join(import.meta.dirname,'store-')),store=new Store(dir);store.state.settings.language='fr';store.state.settings.appearance='classic';store.save();assert.equal(new Store(dir).state.settings.language,'fr');assert.equal(new Store(dir).state.settings.appearance,'classic');
 const profile=store.upsert({name:'Nome',locale:'pt-PT'});assert.equal(profile.name,'Nome');assert.equal(profile.locale,'pt-PT');
});

test('Espera por resultado deixa de consultar depois do tempo limite',async()=>{
 const {until}=await import('../src/operations.mjs');let calls=0;
 await assert.rejects(until(()=>{calls++;return false;},'resultado ausente',45),/Tempo limite/);
 const finalCalls=calls;await new Promise(resolve=>setTimeout(resolve,70));assert.equal(calls,finalCalls);
 assert.equal(await until(()=> 'ready','valor imediato',100),'ready');
});

test('Credenciais de proxy ficam limitadas ao servidor e porta configurados',async()=>{
 const {matchesProxyAuthority}=await import('../src/core.mjs');
 assert.equal(matchesProxyAuthority('proxy.example',443,'https://proxy.example'),true);
 assert.equal(matchesProxyAuthority('proxy.example',80,'https://proxy.example'),false);
 assert.equal(matchesProxyAuthority('other.example',443,'https://proxy.example'),false);
 assert.equal(matchesProxyAuthority('127.0.0.1',8081,'http://127.0.0.1:8080'),false);
 assert.equal(matchesProxyAuthority('::1',8080,'http://[::1]:8080'),true);
 assert.equal(matchesProxyAuthority('proxy.example',undefined,'http://proxy.example'),false);
});

test('Desativar fuso e localizacao conserva os valores sem aplicar os overrides',async()=>{
 const p=validateProfile({name:'Alternar',timezone:'Pacific/Honolulu',latitude:38.7,longitude:-9.1});assert.equal(p.timezoneEnabled,true);assert.equal(p.geolocationEnabled,true);
 const off=validateProfile({...p,latitude:38.7,longitude:-9.1,timezoneEnabled:false,geolocationEnabled:false},p);assert.equal(off.timezone,'Pacific/Honolulu');assert.equal(off.geolocation.latitude,38.7);assert.equal(off.timezoneEnabled,false);assert.equal(off.geolocationEnabled,false);const renamed=validateProfile({name:'Renomeado'},off);assert.equal(renamed.geolocationEnabled,false);assert.equal(renamed.timezoneEnabled,false);
 const {csvText,csvProfile,parseCSV}=await import('../src/workspace.mjs');const copy=csvProfile(parseCSV(csvText([off]))[0]);assert.equal(copy.timezoneEnabled,false);assert.equal(copy.geolocationEnabled,false);assert.equal(copy.geolocation.longitude,-9.1);
 assert.throws(()=>validateProfile({name:'Invalido',timezoneEnabled:true}));assert.throws(()=>validateProfile({name:'Invalido',geolocationEnabled:true}));assert.throws(()=>validateProfile({name:'Invalido',geolocationEnabled:'false'}));
});

test('Registos permitem pesquisar notas e perfis sem truncar os resultados',async()=>{
 const {recordPage}=await import('../src/query.mjs');
 const records=Array.from({length:271},(_,i)=>({id:String(i).padStart(3,'0'),profileId:i%2?'b':'a',title:'Página '+String(i).padStart(3,'0'),url:'https://example.test/'+i,notes:i===270?'Anotação única':'',at:new Date(Date.UTC(2026,0,1,0,i)).toISOString()}));
 const profiles=[{id:'a',name:'Trabalho Norte'},{id:'b',name:'Pessoal'}],last=recordPage(records,{page:999,pageSize:25},profiles);
 assert.equal(last.total,271);assert.equal(last.page,11);assert.equal(last.items.length,21);assert.equal(last.ids.length,271);assert.equal(last.ids[0],'270');
 assert.equal(recordPage(records,{query:'anotacao unica'},profiles).items[0].id,'270');
 assert.equal(recordPage(records,{query:'trabalho norte'},profiles).total,136);
 assert.ok(recordPage(records,{profileId:'b',sort:'title'},profiles).items.every(r=>r.profileId==='b'));
 assert.equal(recordPage(records,{sort:'old',page:1.9,pageSize:10},profiles).items[0].id,'000');
 assert.equal(recordPage(records,{sort:'title-desc'},profiles).items[0].id,'270');
 assert.equal(records[0].id,'000');assert.equal(records[0].position,undefined);
});
test('Eliminar historico e atomico e afeta apenas os registos escolhidos',()=>{
 const store=new Store(mkdtempSync(join(import.meta.dirname,'store-')));
 const a=store.upsert({name:'A'}),b=store.upsert({name:'B'});store.history(a.id,'https://example.test/a','A');store.history(b.id,'https://example.test/b','B');
 const first=store.state.history[0].id,second=store.state.history[1].id;
 assert.throws(()=>store.removeHistory([first,'missing']));assert.equal(store.state.history.length,2);
 assert.throws(()=>store.removeHistory('all'));assert.throws(()=>store.removeHistory([null]));
 assert.equal(store.removeHistory([]),0);assert.equal(store.state.history.length,2);
 assert.equal(store.removeHistory([first,first]),1);assert.equal(store.state.history[0].id,second);
 const restored=new Store(store.directory);assert.equal(restored.state.history.length,1);assert.equal(restored.state.profiles.length,2);
});

test('Grupos paginados conservam contagens, pesquisa e ordenacao sem mutar dados',async()=>{
 const {groupPage}=await import('../src/query.mjs'),groups=Array.from({length:27},(_,i)=>'Grupo '+String(i).padStart(2,'0')),details={'Grupo 26':{description:'Ligação única'}};
 const profiles=[{group:'Grupo 26'},{group:'Grupo 26'},{group:'Grupo 02'}];
 const first=groupPage(groups,details,profiles,{sort:'count'});assert.equal(first.items[0].name,'Grupo 26');assert.equal(first.items[0].count,2);assert.equal(first.total,27);assert.equal(first.pages,3);assert.equal(first.names.length,27);
 const last=groupPage(groups,details,profiles,{page:999});assert.equal(last.page,3);assert.equal(last.items.length,7);
 assert.equal(groupPage(groups,details,profiles,{query:'ligacao unica'}).items[0].name,'Grupo 26');assert.equal(groupPage(groups,details,profiles,{sort:'name-desc'}).items[0].name,'Grupo 26');
 assert.equal(groupPage(groups,details,profiles,{page:2.9}).page,2);assert.equal(groups[0],'Grupo 00');
});
test('Abertura em lote continua apos uma falha e relata o limite sem alargar selecao',async()=>{
 const {openProfileBatch}=await import('../src/operations.mjs');const opened=[],profiles=Array.from({length:12},(_,i)=>({id:String(i),name:'Perfil '+i}));
 const result=await openProfileBatch(profiles,async id=>{opened.push(id);if(id==='1')throw Error('Motor indisponivel');});
 assert.deepEqual(opened,['0','1','2','3','4','5','6','7','8','9']);assert.equal(result.opened,9);assert.equal(result.attempted,10);assert.equal(result.requested,12);assert.equal(result.limited,true);assert.equal(result.failed.length,1);assert.equal(result.failed[0].id,'1');assert.match(result.failed[0].error,/indisponivel/);
});

test('Partilha admite apenas os nomes SQLite de armazenamento dos sites e conserva formatos antigos',async()=>{
 const {mkdirSync,writeFileSync}=await import('node:fs'),{exportSiteStorage,importSiteStorage}=await import('../src/site-storage.mjs');
 const source=mkdtempSync(join(import.meta.dirname,'store-')),target=mkdtempSync(join(import.meta.dirname,'store-'));mkdirSync(join(source,'Default','Local Storage'),{recursive:true});
 writeFileSync(join(source,'Last Version'),'158.0.8123.0');writeFileSync(join(source,'Default','LocalStorage'),'SQLite local fixture');writeFileSync(join(source,'Default','SessionStorage'),'SQLite session fixture');writeFileSync(join(source,'Default','LocalStorage-wal'),'Fixture WAL');writeFileSync(join(source,'Default','Local Storage','legacy.ldb'),'Legacy fixture');writeFileSync(join(source,'Default','Login Data'),'not shared');
 const snapshot=await exportSiteStorage(source,'chromium');await importSiteStorage(target,snapshot,'chromium','Chrome/158.0.8123.0');assert.equal(readFileSync(join(target,'Default','LocalStorage'),'utf8'),'SQLite local fixture');assert.equal(readFileSync(join(target,'Default','Local Storage','legacy.ldb'),'utf8'),'Legacy fixture');
 const {existsSync}=await import('node:fs');assert.equal(existsSync(join(target,'Default','Login Data')),false);
});

test('Fecho em lote aguarda todos os perfis e conserva falhas para nova tentativa',async()=>{
 const {settleOperations}=await import('../src/operations.mjs');let completed=false,attempts=0;
 const retry=()=>{if(attempts++===0)throw Error('Perfil A indisponivel');return 'A';};
 await assert.rejects(settleOperations([retry,async()=>{await new Promise(resolve=>setTimeout(resolve,30));completed=true;}],'Fechar perfis'),error=>error instanceof AggregateError&&error.errors.length===1&&error.message.includes('Perfil A indisponivel'));
 assert.equal(completed,true);assert.deepEqual(await settleOperations([retry]),['A']);
});

test('Fechar pipe Chromium liberta ambos os handles e rejeita comandos pendentes',async()=>{
 const {CDPPipe}=await import('../src/cdp-pipe.mjs'),{PassThrough}=await import('node:stream'),{EventEmitter}=await import('node:events');
 const child=new EventEmitter();child.stdio=[null,null,null,new PassThrough(),new PassThrough()];const pipe=new CDPPipe(child,1000);let closed=0;pipe.on('closed',()=>closed++);
 const command=pipe.send('Browser.getVersion'),rejected=assert.rejects(command,/Ligacao Chromium fechada/);pipe.finish();await rejected;
 assert.equal(child.stdio[3].destroyed,true);assert.equal(child.stdio[4].destroyed,true);assert.equal(pipe.pending.size,0);pipe.finish();assert.equal(closed,1);
 await assert.rejects(pipe.send('Target.getTargets'),/Ligacao Chromium fechada/);
});

test('Menus contextuais limitam URLs e comandos ao documento de origem',async()=>{
 const {pageContextItems,webLink}=await import('../src/page-context-menu.mjs');
 for(const raw of ['javascript:alert(1)','file:///C:/secret','data:text/plain,x','https://user:secret@example.org','not a link'])assert.equal(webLink(raw),null);
 assert.equal(webLink('https://example.org/a?q=1#b'),'https://example.org/a?q=1#b');
 let url='https://example.org/',opened=[],errors=[];const wc={isDestroyed:()=>false,getURL:()=>url,navigationHistory:{canGoBack:()=>false,canGoForward:()=>false}};
 const items=pageContextItems({wc,params:{linkURL:'https://example.org/destination'},t:x=>x,openTab:(...args)=>opened.push(args),report:e=>errors.push(e)});
 await items.find(i=>i.id==='open-link').click();assert.deepEqual(opened,[['https://example.org/destination',true]]);
 url='https://example.org/changed';await items.find(i=>i.id==='open-link').click();assert.equal(opened.length,1);assert.deepEqual(errors,[]);
});
test('Pesquisa de selecao codifica texto e menus respeitam capacidades',async()=>{
 const {pageContextItems}=await import('../src/page-context-menu.mjs');let target;const wc={isDestroyed:()=>false,getURL:()=> 'https://example.org/',navigationHistory:{canGoBack:()=>false,canGoForward:()=>false}};
 const items=pageContextItems({wc,params:{selectionText:'a & b#c',editFlags:{canCopy:true}},t:x=>x,openTab:url=>target=url,report:()=>{}});await items.find(i=>i.id==='search-selection').click();assert.equal(new URL(target).searchParams.get('q'),'a & b#c');assert.equal(items.find(i=>i.id==='copy').enabled,true);assert.equal(items.find(i=>i.id==='back').enabled,false);
 const edit=pageContextItems({wc,params:{isEditable:true,editFlags:{canPaste:false,canCopy:false}},t:x=>x,report:()=>{}});assert.equal(edit.find(i=>i.id==='paste').enabled,false);assert.equal(edit.some(i=>i.id==='save-page'),false);
});

test('Cookie partitions retain site and ancestor scope and reject unsupported imports',()=>{
 const cookie={name:'id',value:'value',domain:'cookie.example.test',hostOnly:true,path:'/',secure:true,partitionKey:{topLevelSite:'https://first.example',hasCrossSiteAncestor:false,untrusted:'ignored'}};
 const restored=cookieForImport(cookie,{partitioned:true});assert.deepEqual(restored.partitionKey,{topLevelSite:'https://first.example',hasCrossSiteAncestor:false});assert.equal(restored.domain,undefined);
 assert.throws(()=>cookieForImport(cookie),/full Chromium/);
 for(const partitionKey of [null,{},'https://first.example',{topLevelSite:'https://first.example',hasCrossSiteAncestor:'false'},{topLevelSite:'https://user:password@first.example',hasCrossSiteAncestor:true},{topLevelSite:'file:///private',hasCrossSiteAncestor:true},{topLevelSite:'https://first.example/path',hasCrossSiteAncestor:true}])assert.throws(()=>cookieForImport({...cookie,partitionKey},{partitioned:true}));
 assert.throws(()=>cookieForImport({...cookie,partitionKeyOpaque:true},{partitioned:true}),/Opaque/);
});
test('Page setup reports the pending command and never continues after timeout',async()=>{
 const {prepareEmbeddedPage}=await import('../src/embedded-page.mjs');const calls=[];let release;
 const contents={isDestroyed:()=>false,loadURL:()=>Promise.resolve(),debugger:{attach:()=>{},sendCommand:method=>{calls.push(method);return new Promise(resolve=>{release=resolve;});}}};
 await assert.rejects(prepareEmbeddedPage(contents,validateProfile({name:'Timeout'}),{width:900,height:500},{timeout:25}),/Page.enable.*Tempo limite/);
 release({});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['Page.enable']);
});
test('Page setup reports initial navigation errors without opening an external page',async()=>{
 const {prepareEmbeddedPage}=await import('../src/embedded-page.mjs');const navigations=[];
 const contents={isDestroyed:()=>false,loadURL:url=>{navigations.push(url);return Promise.reject(Error('Renderer unavailable'));},debugger:{attach:()=>{},sendCommand:()=>new Promise(()=>{})}};
 await assert.rejects(prepareEmbeddedPage(contents,validateProfile({name:'Failure'}),{width:900,height:500},{timeout:100}),/Renderer unavailable/);assert.deepEqual(navigations,['about:blank']);
});

test('Navigation waits for profile readiness and keeps only the latest address',async()=>{
 const {navigatePreparedPage}=await import('../src/embedded-page.mjs');let resolve;const loaded=[];
 const tab={ready:new Promise(r=>{resolve=r}),view:{webContents:{isDestroyed:()=>false,isLoading:()=>false,loadURL:async url=>{loaded.push(url);}}}};
 const first=navigatePreparedPage(tab,'https://first.example'),last=navigatePreparedPage(tab,'https://last.example');assert.deepEqual(loaded,[]);resolve();await Promise.all([first,last]);assert.deepEqual(loaded,['https://last.example']);
});
test('Cancelled or failed setup never opens the queued site',async()=>{
 const {navigatePreparedPage}=await import('../src/embedded-page.mjs');let resolve;const loaded=[];
 const tab={ready:new Promise(r=>{resolve=r}),view:{webContents:{isDestroyed:()=>false,isLoading:()=>false,loadURL:async url=>{loaded.push(url);}}}};
 const navigation=navigatePreparedPage(tab,'https://cancelled.example');tab.pendingNavigation.cancelled=true;resolve();await navigation;assert.deepEqual(loaded,[]);
 tab.ready=Promise.reject(Error('Profile settings failed'));await assert.rejects(navigatePreparedPage(tab,'https://unsafe.example'),/Profile settings failed/);assert.deepEqual(loaded,[]);
});


test('Barra aceita nomes de dominio com porta, localhost e IPv6 sem tratar esquemas perigosos como hosts',()=>{
 assert.equal(safeURL('example.com:8443/path?x=1'),'https://example.com:8443/path?x=1');
 assert.equal(safeURL('localhost:3000/test'),'http://localhost:3000/test');
 assert.equal(safeURL('127.0.0.1:8080/test'),'http://127.0.0.1:8080/test');
 assert.equal(safeURL('[::1]:3000/test'),'http://[::1]:3000/test');
 assert.equal(safeURL('localhost'),'http://localhost/');
 assert.equal(safeURL('https://localhost:3000/test'),'https://localhost:3000/test');
 for(const value of ['javascript:123','data:123','file:123','https://user:secret@localhost:3000','example.com:99999','localhost:99999'])assert.throws(()=>safeURL(value));
});
test('Cookies recusam credenciais portas e caminhos que alterem a autoridade do destino',()=>{
 const cookie={name:'session',value:'fixture',domain:'example.test',hostOnly:true,path:'/'};
 for(const domain of ['example.test@evil.test','example.test:443','example.test?x=1','example.test#fragment','..example.test','example.test:80','example.test?','example.test#'])assert.throws(()=>cookieForImport({...cookie,domain}));
 for(const path of ['@evil.test/','relative','/test\n',42])assert.throws(()=>cookieForImport({...cookie,path}));
 const special=cookieForImport({...cookie,path:'/literal?part#name',secure:true});assert.equal(new URL(special.url).hostname,'example.test');assert.equal(new URL(special.url).search,'');assert.equal(new URL(special.url).hash,'');assert.equal(special.path,'/literal?part#name');
 assert.equal(cookieForImport({...cookie,domain:'[::1]'}).url,'http://[::1]/');
 assert.equal(cookieForImport({...cookie,domain:'.example.test',hostOnly:false}).domain,'.example.test');
});


test('Navegacao aguarda o carregamento real mesmo quando loadURL termina prematuramente',async()=>{
 const {navigatePreparedPage}=await import('../src/embedded-page.mjs');let loading=true,settled=false;
 const tab={ready:Promise.resolve(),view:{webContents:{isDestroyed:()=>false,isLoading:()=>loading,loadURL:async()=>{}}}};
 const job=navigatePreparedPage(tab,'https://pending.example').then(()=>{settled=true;});
 await new Promise(r=>setTimeout(r,25));assert.equal(settled,false);loading=false;await job;assert.equal(settled,true);
 loading=true;const cancelled=navigatePreparedPage(tab,'https://cancelled.example');await Promise.resolve();tab.pendingNavigation.cancelled=true;await cancelled;
 const superseded=navigatePreparedPage(tab,'https://superseded.example');await Promise.resolve();tab.pendingNavigation={};await superseded;
});


test('Edicao conserva precisao existente e coordenadas novas usam o valor predefinido',()=>{
 const original=validateProfile({name:'GPS',latitude:38.7,longitude:-9.1,geolocationAccuracy:4.5});
 assert.equal(validateProfile({...original,name:'Renamed',latitude:38.7,longitude:-9.1},original).geolocation.accuracy,4.5);
 assert.equal(validateProfile({...original,latitude:40,longitude:-8},original).geolocation.accuracy,100);
 assert.equal(validateProfile({...original,latitude:40,longitude:-8,geolocationAccuracy:0},original).geolocation.accuracy,0);
 for(const accuracy of [-1,NaN,Infinity])assert.throws(()=>validateProfile({name:'Invalid',latitude:0,longitude:0,geolocationAccuracy:accuracy}));
});
test('Filtros distinguem ocupado de em execucao e parado',async()=>{
 const {profilePage}=await import('../src/query.mjs');const profiles=[{id:'busy',name:'Busy',busy:true,running:false},{id:'running',name:'Running',running:true},{id:'stopped',name:'Stopped',running:false}];
 for(const status of ['busy','running','stopped'])assert.deepEqual(profilePage(profiles,{status}).ids,[status]);
 assert.deepEqual(profilePage(profiles,{sort:'status'}).ids,['busy','running','stopped']);assert.deepEqual(profilePage(profiles,{sort:'status-desc'}).ids,['stopped','running','busy']);
});
