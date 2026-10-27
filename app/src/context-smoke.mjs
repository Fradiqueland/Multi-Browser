import {capturePage} from './capture-page.mjs';
import assert from 'node:assert/strict';
import {BrowserWindow,Menu,clipboard,webContents} from 'electron';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {bounded,until,closeHTTPServer} from './operations.mjs';

export async function runContextSmoke({manager,directory,pass}){
 const request=(action,data={})=>manager.webContents.executeJavaScript('window.desktop.request('+JSON.stringify(action)+','+JSON.stringify(data)+')');
 const wait=predicate=>until(predicate,'menus de contexto',10000);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=','base64');
 const server=createServer((req,res)=>{
  if(req.url==='/image.png'){res.setHeader('Content-Type','image/png');res.end(png);return;}
  if(req.url==='/download'){res.setHeader('Content-Type','application/octet-stream');res.end('context-download-fixture');return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Context fixture</title><style>body{margin:20px}a,img,textarea{display:block;margin-bottom:20px}img{width:40px;height:40px}</style><a id="link" href="/destination">Local link</a><a id="download" href="/download">Download</a><a id="unsafe" href="javascript:void(0)">Script link</a><a id="credential" href="http://user:secret@127.0.0.1/">Credential link</a><img id="image" src="/image.png"><textarea id="edit">alpha beta</textarea><p id="selection">needle &amp; punctuation</p>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const realBuilder=Menu.buildFromTemplate,realCopy=clipboard.writeText;let template,copied,profile,other,win,doc;
 try{
  const previous=new Set(BrowserWindow.getAllWindows().map(w=>w.id));profile=await request('save',{name:'Context menus fixture',engine:'embedded',startURL:origin+'/'});await request('open',{id:profile.id});
  win=BrowserWindow.getAllWindows().find(w=>!previous.has(w.id));assert.ok(win);win.show();
  const evaluate=code=>bounded(win.webContents.executeJavaScript(code),'barra de contexto',10000),state=()=>evaluate("window.desktop.request('browserState')"),tabRequest=(action,data={})=>evaluate('window.desktop.request('+JSON.stringify(action)+','+JSON.stringify(data)+')');
  await wait(()=>{doc=win.contentView.children.find(v=>v.webContents?.getURL()===origin+'/')?.webContents;return doc&&!doc.isLoading();});
  const initial=await state(),initialTab=initial.activeId;
  Menu.buildFromTemplate=items=>{template=items;return {popup(){}};};clipboard.writeText=value=>{copied=value;};
  const menu=async(selector,contents=doc)=>{
   template=null;win.focus();contents.focus();await wait(()=>win.isFocused()&&contents.isFocused());await bounded(contents.executeJavaScript('Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),new Promise(resolve=>setTimeout(resolve,250))])'),'documento desenhado',5000);
   const painted=await capturePage(contents);if(painted.isEmpty())throw Error('Context document has no painted frame.');
   await contents.executeJavaScript("window.__contextTestEvents=[];if(!window.__contextTestListening){window.__contextTestListening=true;for(const type of ['mousedown','mouseup','contextmenu'])document.addEventListener(type,e=>{window.__contextTestEvents.push({type,button:e.button,x:e.clientX,y:e.clientY,target:e.target.id||e.target.tagName});window.__contextTestEvents=window.__contextTestEvents.slice(-12)},true)}");
   const point=await contents.executeJavaScript('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()');
   contents.sendInputEvent({type:'mouseMove',...point});await new Promise(resolve=>setTimeout(resolve,100));
   for(let attempt=0;attempt<3&&!template;attempt++){
    win.focus();contents.focus();contents.sendInputEvent({type:'mouseMove',...point});
    contents.sendInputEvent({type:'mouseDown',button:'right',clickCount:1,...point});contents.sendInputEvent({type:'mouseUp',button:'right',clickCount:1,...point});
    try{await until(()=>!!template,'menu nativo apos clique real',2000);}catch(error){if(attempt===2){writeFileSync(join(directory,'context-failed-frame.png'),(await capturePage(contents)).toPNG());const input=await contents.executeJavaScript('window.__contextTestEvents');throw Error(error.message+' '+JSON.stringify({selector,point,url:contents.getURL(),focused:contents.isFocused(),windowFocused:win.isFocused(),input}));}}
   }return template;
  };
  const command=id=>{const item=template.find(i=>i.id===id);assert.ok(item,'Context command '+id);assert.notEqual(item.enabled,false,'Disabled command '+id);return item;};
  await menu('#link');pass('Botao direito real apresenta menu de ligacao traduzido',command('open-link').label==='Open link in new tab');
  await command('copy-link').click();pass('Copiar ligacao usa endereco completo sem navegar',copied===origin+'/destination'&&doc.getURL()===origin+'/');
  await doc.executeJavaScript("document.cookie='contextProfile=first; path=/'");const focusBeforeBackground=doc.isFocused();await command('open-link').click();await wait(async()=>(await state()).tabs.length===2);await wait(()=>webContents.getAllWebContents().some(w=>w.session===doc.session&&w.getURL()===origin+'/destination'&&!w.isLoading()));
  const background=webContents.getAllWebContents().find(w=>w.session===doc.session&&w.getURL()===origin+'/destination');const backgroundIsVisible=()=>win.contentView.children.some(v=>v.webContents===background&&v.getVisible());
  assert.ok((await state()).activeId===initialTab&&doc.isFocused()&&!backgroundIsVisible(),JSON.stringify({active:(await state()).activeId,initialTab,focused:doc.isFocused(),visible:backgroundIsVisible(),focusBeforeBackground,windowFocused:win.isFocused(),backgroundFocus:background.isFocused(),shellFocused:win.webContents.isFocused(),domFocus:await doc.executeJavaScript('document.hasFocus()')}));
  pass('Abrir ligacao em segundo plano conserva separador e foco',(await state()).activeId===initialTab&&doc.isFocused()&&!backgroundIsVisible());
  pass('Ligacao em segundo plano conserva a sessao do perfil',background.session===doc.session&&(await background.executeJavaScript('document.cookie')).includes('contextProfile=first'));
  for(const button of ['left','middle']){
   const before=(await state()).tabs.length;doc.focus();doc.sendInputEvent({type:'mouseDown',button,clickCount:1,x:40,y:28,modifiers:button==='left'?['control']:[]});doc.sendInputEvent({type:'mouseUp',button,clickCount:1,x:40,y:28,modifiers:button==='left'?['control']:[]});
   await wait(async()=>(await state()).tabs.length===before+1);pass(button==='left'?'Ctrl clique abre ligacao sem mudar separador':'Botao central abre ligacao sem mudar separador',(await state()).activeId===initialTab);
   const created=(await state()).tabs.at(-1);await tabRequest('tabClose',{id:created.id});await wait(async()=>(await state()).tabs.length===before);
  }
  const backgroundTab=(await state()).tabs.find(t=>t.id!==initialTab);await tabRequest('tabSelect',{id:backgroundTab.id});await wait(()=>background.isFocused());pass('Selecionar segundo plano liga o documento a janela',win.contentView.children.some(v=>v.webContents===background&&v.getVisible()));await tabRequest('tabSelect',{id:initialTab});
  await menu('#link');await command('open-link-active').click();await wait(async()=>(await state()).activeId!==initialTab);pass('Abrir ligacao e mudar seleciona o novo documento',(await state()).tabs.length===3);
  await tabRequest('tabSelect',{id:initialTab});
  await menu('#unsafe');pass('Menu nao executa nem transfere ligacoes javascript',!template.some(i=>['open-link','save-link','copy-link'].includes(i.id)));
  await menu('#credential');pass('Menu recusa enderecos com credenciais embutidas',!template.some(i=>i.id==='open-link'||i.id==='copy-link'));
  await menu('#image');pass('Menu de imagem contem abrir copiar e guardar',['open-image','copy-image-url','copy-image','save-image'].every(id=>template.some(i=>i.id===id&&i.enabled)));
  await command('copy-image-url').click();pass('Copiar endereco da imagem conserva URL exato',copied===origin+'/image.png');
  const beforeImage=(await state()).tabs.length;await command('open-image').click();await wait(async()=>(await state()).tabs.length===beforeImage+1&&(await state()).tabs.at(-1).url===origin+'/image.png');pass('Abrir imagem cria separador sem retirar o foco',(await state()).activeId===initialTab&&doc.isFocused());await tabRequest('tabClose',{id:(await state()).tabs.at(-1).id});await menu('#image');
  const downloadPath=join(directory,'context-image.png');doc.session.once('will-download',(_event,item)=>item.setSavePath(downloadPath));await command('save-image').click();await wait(async()=>(await request('state')).downloads.some(d=>d.profileId===profile.id&&d.state==='completed'&&d.path===downloadPath));
  pass('Guardar imagem descarrega bytes reais no perfil correto',readFileSync(downloadPath).equals(png));
  await menu('#download');const linkPath=join(directory,'context-download.bin');doc.session.once('will-download',(_event,item)=>item.setSavePath(linkPath));await command('save-link').click();await wait(async()=>(await request('state')).downloads.some(d=>d.profileId===profile.id&&d.state==='completed'&&d.path===linkPath));pass('Guardar ligacao usa transferencia real sem alterar pagina',readFileSync(linkPath,'utf8')==='context-download-fixture'&&doc.getURL()===origin+'/');
  await doc.executeJavaScript("document.querySelector('#edit').focus();document.querySelector('#edit').select()");await menu('#edit');pass('Campo editavel oferece comandos de edicao completos',['undo','redo','cut','copy','paste','pasteAndMatchStyle','delete','selectAll'].every(id=>template.some(i=>i.id===id)));
  await command('delete').click();await wait(()=>doc.executeJavaScript("document.querySelector('#edit').value===''") );pass('Eliminar no menu altera apenas o campo selecionado',true);
  await menu('#edit');await command('undo').click();await wait(()=>doc.executeJavaScript("document.querySelector('#edit').value==='alpha beta'") );pass('Anular restaura edicao real do documento',true);
  await menu('#edit');await command('redo').click();await wait(()=>doc.executeJavaScript("document.querySelector('#edit').value===''") );pass('Refazer reaplica edicao real do documento',true);
  await doc.executeJavaScript("document.querySelector('#edit').value='new selection';document.querySelector('#edit').focus()");await menu('#edit');await command('selectAll').click();pass('Selecionar tudo atua no campo do documento',await doc.executeJavaScript("(()=>{const e=document.querySelector('#edit');return e.selectionStart===0&&e.selectionEnd===e.value.length})()"));
  await menu('#link');const stale=command('open-link');await tabRequest('navigate',{url:origin+'/changed'});const countBefore=(await state()).tabs.length;await stale.click();pass('Comando antigo e ignorado depois de navegar',(await state()).tabs.length===countBefore);
  await tabRequest('navigate',{url:origin+'/'});await doc.executeJavaScript("document.querySelector('#link').focus()");doc.sendInputEvent({type:'mouseMove',x:40,y:28});await wait(()=>evaluate("!document.querySelector('#link-target').hidden"));pass('Passar sobre ligacao mostra destino na barra',await evaluate("document.querySelector('#link-target').textContent")===origin+'/destination');
  await tabRequest('tabNew');await wait(()=>evaluate("document.querySelector('#link-target').hidden"));pass('Mudar separador limpa destino da ligacao anterior',true);
  await evaluate("document.querySelector('#address').value='edit me';document.querySelector('#address').focus();document.querySelector('#address').select()");await menu('#address',win.webContents);pass('Barra de endereco tem menu de edicao proprio',template.some(i=>i.id==='cut'&&i.enabled)&&!template.some(i=>i.id==='open-link'));
  await command('delete').click();await wait(()=>evaluate("document.querySelector('#address').value===''") );pass('Eliminar na barra nao altera o documento externo',await doc.executeJavaScript("document.querySelector('#edit').value==='alpha beta'"));
  other=await request('save',{name:'Context isolation fixture',engine:'embedded',startURL:origin+'/'});const beforeOther=new Set(BrowserWindow.getAllWindows().map(w=>w.id));await request('open',{id:other.id});const otherWindow=BrowserWindow.getAllWindows().find(w=>!beforeOther.has(w.id));let otherDoc;await wait(()=>{otherDoc=otherWindow.contentView.children.find(v=>v.webContents?.getURL()===origin+'/')?.webContents;return otherDoc&&!otherDoc.isLoading();});pass('Ligacoes e transferencias nao partilham cookies com outro perfil',!(await otherDoc.executeJavaScript('document.cookie')).includes('contextProfile=first'));
  await tabRequest('tabSelect',{id:initialTab});win.focus();await bounded(doc.executeJavaScript('Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),new Promise(resolve=>setTimeout(resolve,250))])'),'captura de menus',5000);writeFileSync(join(directory,'context-browser.png'),(await win.capturePage()).toPNG());
 }finally{
  Menu.buildFromTemplate=realBuilder;clipboard.writeText=realCopy;
  for(const p of [other,profile])if(p){await request('stop',{id:p.id});await request('delete',{id:p.id});}
  await closeHTTPServer(server,'servidor de menus');
 }
}
