import {t,localizeDocument} from './i18n.mjs';
const translate=localizeDocument(document),form=document.querySelector('#bookmark-editor'),error=document.querySelector('#editor-error');
const request=(action,data={})=>window.desktop.request(action,data);
const close=()=>request('bookmarkEditorClose').catch(()=>{});
request('bookmarkEditorState').then(state=>{translate(state.language);document.body.classList.toggle('light',state.theme==='light');document.querySelector('#profile-name').textContent=state.profileName;for(const key of ['title','url','notes'])form.elements[key].value=state.bookmark[key]||'';document.querySelector('#remove-bookmark').hidden=!state.bookmark.id;form.elements.title.focus();form.elements.title.select();}).catch(e=>error.textContent=t(e.message));
form.onsubmit=async event=>{event.preventDefault();const save=document.querySelector('#save-bookmark');save.disabled=true;error.textContent='';try{await request('bookmarkEditorSave',Object.fromEntries(new FormData(form)));await close();}catch(e){error.textContent=t(e.message.replace(/^Error invoking remote method.*Error: /,''));save.disabled=false;}};
document.querySelector('#cancel-bookmark').onclick=close;
document.querySelector('#remove-bookmark').onclick=async()=>{try{await request('bookmarkEditorRemove');await close();}catch(e){error.textContent=t(e.message);}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
