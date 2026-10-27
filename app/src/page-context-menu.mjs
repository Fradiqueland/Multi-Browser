// Menus are scoped to the WebContents that raised the event, never the manager.
export function webLink(value){
 try{const url=new URL(String(value));return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function editingItems(wc,params,t,run){
 const flags=params.editFlags||{},items=[];
 const add=(label,method,flag)=>items.push({id:method,label:t(label),enabled:flags[flag]===true,click:()=>run(()=>wc[method]())});
 if(params.isEditable){add('Anular','undo','canUndo');add('Refazer','redo','canRedo');items.push({type:'separator'});add('Cortar','cut','canCut');}
 if(params.isEditable||params.selectionText)add('Copiar','copy','canCopy');
 if(params.isEditable){add('Colar','paste','canPaste');add('Colar sem formatação','pasteAndMatchStyle','canPaste');add('Eliminar','delete','canDelete');items.push({type:'separator'});add('Selecionar tudo','selectAll','canSelectAll');}
 return items;
}
export function pageContextItems({wc,params,t,openTab,savePage,clipboard,report,isCurrent=()=>true}){
 const originalURL=wc.getURL(),originalFrame=params.frame,items=[];
 const run=action=>{if(!isCurrent()||wc.isDestroyed()||wc.getURL()!==originalURL||originalFrame?.isDestroyed?.())return;try{return Promise.resolve(action()).catch(report);}catch(error){report(error);}};
 const add=(id,label,action,enabled=true)=>items.push({id,label:t(label),enabled,click:()=>run(action)});
 const separate=()=>{if(items.length&&items.at(-1).type!=='separator')items.push({type:'separator'});};
 const link=webLink(params.linkURL),media=webLink(params.srcURL);
 if(link){
  add('open-link','Abrir ligação num novo separador',()=>openTab(link,true));
  add('open-link-active','Abrir ligação e mudar de separador',()=>openTab(link,false));
  add('copy-link','Copiar endereço da ligação',()=>clipboard.writeText(link));
  add('save-link','Guardar ligação como…',()=>wc.downloadURL(link));separate();
 }
 if(params.mediaType==='image'){
  if(media){add('open-image','Abrir imagem num novo separador',()=>openTab(media,true));add('copy-image-url','Copiar endereço da imagem',()=>clipboard.writeText(media));add('save-image','Guardar imagem como…',()=>wc.downloadURL(media));}
  add('copy-image','Copiar imagem',()=>wc.copyImageAt(params.x,params.y),params.hasImageContents===true);separate();
 }else if(['audio','video'].includes(params.mediaType)&&media){
  add('open-media','Abrir multimédia num novo separador',()=>openTab(media,true));add('copy-media-url','Copiar endereço multimédia',()=>clipboard.writeText(media));add('save-media','Guardar multimédia como…',()=>wc.downloadURL(media),params.mediaFlags?.canSave===true);separate();
 }
 items.push(...editingItems(wc,params,t,run));
 const selection=String(params.selectionText||'').trim().slice(0,2000);
 if(selection&&!params.isEditable)add('search-selection','Pesquisar texto selecionado',()=>openTab('https://www.google.com/search?q='+encodeURIComponent(selection),false));
 if(!params.isEditable){
  separate();add('back','Recuar',()=>wc.navigationHistory.goBack(),wc.navigationHistory.canGoBack());add('forward','Avançar',()=>wc.navigationHistory.goForward(),wc.navigationHistory.canGoForward());add('reload','Recarregar',()=>wc.reload());separate();
  add('save-page','Guardar página',savePage,!!webLink(originalURL));add('print','Imprimir',()=>wc.print({silent:false}));
 }
 while(items.at(-1)?.type==='separator')items.pop();return items;
}
