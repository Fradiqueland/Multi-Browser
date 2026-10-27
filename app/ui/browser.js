import {primaryShortcut} from './shortcuts.mjs';
import {t,localizeDocument} from './i18n.mjs';
const applyLanguage=localizeDocument(document);
let current,activeTabId,activeURL;
const request=async(action,data={})=>{try{return await window.desktop.request(action,data);}catch(e){document.querySelector('#page-error').textContent=t(e.message.replace(/^Error invoking remote method.*Error: /,''));}};
function render(value){
 if(value?.type==='link-target'){if(current?.activeId===value.tabId){const status=document.querySelector('#link-target');status.textContent=value.url;status.hidden=!value.url;}return;}
 if(value?.type==='focus-address'){document.querySelector('#address').focus();document.querySelector('#address').select();return;}
 if(value?.type==='find'){showFind();return;}
 if(value?.type==='find-close'){closeFind();return;}
 if(value?.type==='find-result'){document.querySelector('#find-count').textContent=value.ordinal+' / '+value.matches;return;}
 if(value?.type==='find-next'){if(document.querySelector('#find-query').value)findNext(value.forward);else showFind();return;}
 if(!value?.profile)return;
 const previousActive=current?.activeId;
 if(previousActive!==value.activeId){const status=document.querySelector('#link-target');status.textContent='';status.hidden=true;}
 applyLanguage(value.language||'en');document.body.classList.toggle('classic',value.appearance==='classic');current=value;document.body.classList.toggle('light',value.theme==='light');
 const bar=document.querySelector('#bookmark-bar');bar.replaceChildren();bar.hidden=value.showBookmarks===false;
 for(const bookmark of value.bookmarks||[]){const link=document.createElement('button');link.textContent=bookmark.title||bookmark.url;link.title=bookmark.url;link.onclick=()=>request('bookmarkNavigate',{id:bookmark.id});bar.append(link);}
document.querySelector('#profile-name').textContent=value.profile.name;
 const active=value.tabs.find(t=>t.id===value.activeId);
 for(const [action,enabled] of [['back',active?.canGoBack],['forward',active?.canGoForward]])document.querySelector('[data-action='+action+']').disabled=!enabled;
 const reload=document.querySelector('#reload');reload.textContent=active?.loading?'×':'↻';reload.title=t(active?.loading?'Parar carregamento':'Recarregar');
 document.querySelector('#zoom-reset').textContent=Math.round((active?.zoom||1)*100)+'%';
 const bookmark=(value.bookmarks||[]).find(b=>b.url===active?.url),star=document.querySelector('#star');star.textContent=bookmark?'★':'☆';star.setAttribute('aria-pressed',String(!!bookmark));star.title=t(bookmark?'Editar favorito':'Guardar favorito');star.disabled=!/^https?:/.test(active?.url||'');
 if(activeTabId!==active?.id||activeURL!==active?.url){document.querySelector('#find-query').value=active?.find?.query||'';document.querySelector('#find-count').textContent=(active?.find?.ordinal||0)+' / '+(active?.find?.matches||0);activeTabId=active?.id;activeURL=active?.url;}

 if(previousActive!==value.activeId||document.activeElement!==document.querySelector('#address'))document.querySelector('#address').value=active?.url==='about:blank'?'':active?.url||'';
 document.querySelector('#page-error').textContent=active?.error||'';
 const tabs=document.querySelector('#tabs'),scrollLeft=tabs.scrollLeft;tabs.setAttribute('role','tablist');tabs.replaceChildren();
 for(const tab of value.tabs){const item=document.createElement('div');item.className='tab'+(tab.id===value.activeId?' active':'');const select=document.createElement('button');select.textContent=(tab.loading?'◌ ':'')+(tab.title==='Novo separador'?t(tab.title):tab.title);select.setAttribute('role','tab');select.setAttribute('aria-selected',String(tab.id===value.activeId));select.title=tab.title;select.onclick=()=>request('tabSelect',{id:tab.id});select.onauxclick=e=>{if(e.button===1){e.preventDefault();request('tabClose',{id:tab.id});}};item.oncontextmenu=e=>{e.preventDefault();request('tabMenu',{id:tab.id});};const close=document.createElement('button');close.className='close';close.textContent='×';close.title=t('Fechar separador');close.setAttribute('aria-label',t('Fechar separador')+' '+tab.title);close.onclick=()=>request('tabClose',{id:tab.id});if(tab.muted){const muted=document.createElement('span');muted.className='tab-muted';muted.textContent='🔇';muted.title=t('Silenciar separador');item.append(muted);}item.append(select,close);item.dataset.tabId=tab.id;tabs.append(item);}
 tabs.scrollLeft=scrollLeft;if(previousActive!==value.activeId)tabs.querySelector('.tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
window.desktop.subscribe(render);
window.desktop.request('browserState').then(render);
document.querySelector('#new-tab').onclick=()=>request('tabNew');
document.querySelector('#navigation').onsubmit=e=>{e.preventDefault();request('navigate',{url:document.querySelector('#address').value});document.querySelector('#address').blur();};
for(const b of document.querySelectorAll('[data-action]'))b.onclick=()=>request(b.dataset.action);
document.querySelector('#star').onclick=()=>request('bookmarkEditor');
document.querySelector('#reload').onclick=()=>request(current?.tabs.find(t=>t.id===current.activeId)?.loading?'stopLoading':'reload');
document.querySelector('#zoom-reset').onclick=()=>request('zoom',{reset:true});
document.querySelector('#zoom-in').onclick=()=>request('zoom',{delta:.1});
document.querySelector('#zoom-out').onclick=()=>request('zoom',{delta:-.1});
function showFind(){const input=document.querySelector('#find-query');input.hidden=false;document.querySelector('#find-controls').hidden=false;input.focus();}
function closeFind(){const input=document.querySelector('#find-query');input.hidden=true;input.value='';document.querySelector('#find-controls').hidden=true;document.querySelector('#find-count').textContent='0 / 0';request('find',{query:''});}
function findNext(forward=true){const query=document.querySelector('#find-query').value;if(query)request('find',{query,forward,findNext:true});}
document.querySelector('#find').onclick=()=>document.querySelector('#find-query').hidden?showFind():closeFind();
document.querySelector('#find-query').oninput=e=>{document.querySelector('#find-count').textContent='0 / 0';request('find',{query:e.target.value});};
document.querySelector('#find-query').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();closeFind();}if(e.key==='Enter'){e.preventDefault();findNext(!e.shiftKey);}};
document.querySelector('#find-next').onclick=()=>findNext(true);document.querySelector('#find-previous').onclick=()=>findNext(false);document.querySelector('#find-close').onclick=closeFind;
document.addEventListener('keydown',e=>{if(primaryShortcut(e,current?.platform)&&e.key.toLowerCase()==='l'){e.preventDefault();document.querySelector('#address').focus();document.querySelector('#address').select();}if(primaryShortcut(e,current?.platform)&&e.key.toLowerCase()==='t'){e.preventDefault();request('tabNew',{reopen:e.shiftKey});}if(e.key==='F3'){e.preventDefault();if(document.querySelector('#find-query').value)findNext(!e.shiftKey);else showFind();}});

document.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if(e.key==='F11'){e.preventDefault();request('fullscreen');}
 if(e.key==='F6'){e.preventDefault();document.querySelector('#address').focus();document.querySelector('#address').select();}
 if(e.ctrlKey&&!e.altKey&&['Tab','PageUp','PageDown'].includes(e.key)){e.preventDefault();request('tabStep',{delta:e.key==='PageUp'||(e.key==='Tab'&&e.shiftKey)?-1:1});}
 if(primaryShortcut(e,current?.platform)&&/^[1-9]$/.test(e.key)){e.preventDefault();request('tabNumber',{number:Number(e.key)});}
 if(primaryShortcut(e,current?.platform)&&key==='p'){e.preventDefault();request('print');}
 if(primaryShortcut(e,current?.platform)&&key==='s'){e.preventDefault();request('savePage');}
 if(primaryShortcut(e,current?.platform)&&key==='w'){e.preventDefault();if(current?.activeId)request(e.shiftKey?'closeBrowserWindow':'tabClose',{id:current.activeId});}
 if(primaryShortcut(e,current?.platform)&&key==='f'){e.preventDefault();showFind();}
 if(primaryShortcut(e,current?.platform)&&e.shiftKey&&key==='b'){e.preventDefault();request('toggleBookmarks');}

 if((primaryShortcut(e,current?.platform)&&key==='r')||e.key==='F5'){e.preventDefault();request('reload',{ignoreCache:e.shiftKey});}
 if(primaryShortcut(e,current?.platform)&&key==='d'){e.preventDefault();request('bookmarkEditor');}
 if(primaryShortcut(e,current?.platform)&&['0','+','=','-'].includes(e.key)){e.preventDefault();request('zoom',e.key==='0'?{reset:true}:{delta:e.key==='-'?-.1:.1});}
 if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();request(e.key==='ArrowLeft'?'back':'forward');}
 if(e.key==='Escape'){e.preventDefault();closeFind();request('stopLoading');}
});
