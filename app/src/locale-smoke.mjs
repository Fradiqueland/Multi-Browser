import {capturePage} from './capture-page.mjs';
import {shell} from 'electron';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {bounded,until} from './operations.mjs';
import {t,LANGUAGES} from '../ui/i18n.mjs';
export async function runLocaleSmoke({manager,directory,pass}){
 const evaluate=code=>bounded(manager.webContents.executeJavaScript(code),'localizacao da interface',10000),request=(action,data={})=>evaluate('window.desktop.request('+JSON.stringify(action)+','+JSON.stringify(data)+')'),wait=p=>until(p,'interface traduzida',10000),click=s=>evaluate('document.querySelector('+JSON.stringify(s)+').click()');
 const titles={en:'Browser profiles',pt:'Perfis de navegação',es:'Perfiles del navegador',fr:'Profils du navigateur',hi:'ब्राउज़र प्रोफ़ाइल',ar:'ملفات المتصفح الشخصية',zh:'浏览器配置文件',bn:'ব্রাউজার প্রোফাইল',ru:'Профили браузера',id:'Profil browser',it:'Profili del browser'};
 pass('Ingles e idioma inicial numa instalacao nova',(await request('state')).settings.language==='en'&&await evaluate('document.documentElement.lang==="en"&&document.querySelector("h1").textContent==="Browser profiles"'));
 pass('Seletor inclui os dez idiomas pedidos e conserva italiano',await evaluate('JSON.stringify([...document.querySelector("#ui-language").options].map(o=>o.value))==='+JSON.stringify(JSON.stringify(LANGUAGES.map(l=>l.id)))));
 await wait(()=>evaluate('document.querySelector("#author-photo").complete&&document.querySelector("#author-photo").naturalWidth===1024'));
 pass('Fotografia local e nome do autor apresentados no menu',await evaluate('document.querySelector("#author-photo").naturalHeight===1024&&document.querySelector("#author-photo").src.startsWith("file:")&&document.querySelector("#author-name").textContent==="Antonio Fradique"'));
 pass('Cabecalho de acoes traduzido em ingles',await evaluate('[...document.querySelectorAll("th")].some(e=>e.textContent==="Actions")&&!document.querySelector("#profiles").textContent.includes("Ações")'));
 const originalExternal=shell.openExternal,calls=[];shell.openExternal=async url=>{calls.push(url);};
 try{const oldURL=manager.webContents.getURL();await click('#author-products');await wait(()=>calls.length===1);pass('Link do autor abre apenas o site fixo no navegador externo',calls[0]==='https://AntonioFradique.net'&&manager.webContents.getURL()===oldURL);await request('authorWebsite',{url:'file:///C:/Windows/win.ini'});pass('Acao de autoria nao aceita substituir o destino por entrada arbitraria',calls.length===2&&calls[1]==='https://AntonioFradique.net');}finally{shell.openExternal=originalExternal;}
 for(const {id} of LANGUAGES){
  await evaluate('document.querySelector("#ui-language").value='+JSON.stringify(id)+';document.querySelector("#ui-language").dispatchEvent(new Event("change"))');
  await wait(()=>evaluate('document.documentElement.lang==='+JSON.stringify(id)+'&&document.querySelector("h1").textContent==='+JSON.stringify(titles[id])));
  pass('Menu titulo e autoria traduzidos em '+id,(await request('state')).settings.language===id&&await evaluate('document.querySelector(".author-label").textContent==='+JSON.stringify(t('Criado por:',id))+'&&document.querySelector(".author-products-label").textContent==='+JSON.stringify(t('Mais Produtos em:',id))+'&&document.documentElement.dir==='+JSON.stringify(id==='ar'?'rtl':'ltr')));
  await click('#new-profile');pass('Formulario e motor traduzidos em '+id,await evaluate('document.querySelector("#save-profile").textContent==='+JSON.stringify(t('Guardar perfil',id))+'&&document.querySelector("#profile-group-add").textContent==='+JSON.stringify(t('Adicionar',id))+'&&document.querySelector("#engine option[value=embedded]").textContent==='+JSON.stringify(t('Integrado (Electron)',id))));
  if(['hi','ar','zh','bn','ru','id'].includes(id)){await evaluate('Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),new Promise(resolve=>setTimeout(resolve,300))])');await new Promise(resolve=>setTimeout(resolve,220));writeFileSync(join(directory,'locale-'+id+'-form.png'),(await capturePage(manager.webContents)).toPNG());}
  await evaluate('document.querySelector("#profile-dialog").close()');
 }
 await request('language',{language:'ar'});await wait(()=>evaluate('document.documentElement.dir==="rtl"'));
 const reload=new Promise(resolve=>manager.webContents.once('did-finish-load',resolve));manager.webContents.reload();await bounded(reload,'recarregar idioma arabe',10000);await wait(()=>evaluate('document.documentElement.lang==="ar"&&document.documentElement.dir==="rtl"').catch(()=>false));pass('Arabe e direcao RTL persistem ao recarregar',true);
 const bounds=manager.getBounds();try{
  manager.setBounds({width:900,height:660});await wait(()=>evaluate('innerWidth<=900'));
  pass('Menu arabe fica a direita sem sobrepor o conteudo',await evaluate('(()=>{const side=document.querySelector("aside").getBoundingClientRect(),main=document.querySelector("main").getBoundingClientRect();return side.right<=innerWidth+1&&side.left>=main.right-1})()'));
  await evaluate('document.querySelector("#author-products").scrollIntoView({block:"nearest"})');pass('Autoria e link acessiveis na janela pequena',await evaluate('(()=>{const r=document.querySelector("#author-products").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth&&r.left>=0})()'));
  await click('#new-profile');pass('Formulario arabe conserva botoes visiveis e enderecos LTR',await evaluate('(()=>{const r=document.querySelector("#save-profile").getBoundingClientRect();return r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&getComputedStyle(document.querySelector("[name=proxy]")).direction==="ltr"})()'));await evaluate('document.querySelector("#profile-dialog").close()');
 }finally{manager.setBounds(bounds);}
 await evaluate('document.querySelector("aside").scrollTop=0');await evaluate('Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),new Promise(resolve=>setTimeout(resolve,300))])');writeFileSync(join(directory,'locale-ar-manager.png'),(await capturePage(manager.webContents)).toPNG());
 await request('language',{language:'en'});await wait(()=>evaluate('document.documentElement.dir==="ltr"'));await evaluate('Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),new Promise(resolve=>setTimeout(resolve,300))])');writeFileSync(join(directory,'locale-en-manager.png'),(await capturePage(manager.webContents)).toPNG());
 pass('Regressar ao ingles repoe menu e direcao LTR',await evaluate('document.querySelector("aside").getBoundingClientRect().left===0'));
 // The older regression cases intentionally exercise the original Portuguese UI.
 await request('language',{language:'pt'});
}
