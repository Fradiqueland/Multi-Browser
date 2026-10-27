import {profileGroups} from './groups.mjs';
export const normalizeSearch=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function profilePage(profiles,{query='',group='',status='',sort='new',page=1,pageSize=10}={}){
 const normalize=normalizeSearch;
 const q=normalize(query),value=(p,key)=>String(key==='group'?profileGroups(p).join(', '):p[key]??'');
 const filtered=profiles.filter(p=>normalize(p.name+' '+profileGroups(p).join(' ')+' '+p.notes).includes(q)&&(!group||profileGroups(p).includes(group))&&(!status||(status==='busy'?p.busy:status==='running'?p.running:!p.running&&!p.busy)));
 const comparisons={
  name:(a,b)=>value(a,'name').localeCompare(value(b,'name'),'pt-PT'),
  'name-desc':(a,b)=>value(b,'name').localeCompare(value(a,'name'),'pt-PT'),
  new:(a,b)=>value(b,'createdAt').localeCompare(value(a,'createdAt')),
  old:(a,b)=>value(a,'createdAt').localeCompare(value(b,'createdAt')),
  opened:(a,b)=>value(b,'lastOpened').localeCompare(value(a,'lastOpened')),
  'opened-old':(a,b)=>value(a,'lastOpened').localeCompare(value(b,'lastOpened')),
  group:(a,b)=>value(a,'group').localeCompare(value(b,'group'),'pt-PT'),
  'group-desc':(a,b)=>value(b,'group').localeCompare(value(a,'group'),'pt-PT'),
  status:(a,b)=>(b.busy?2:Number(!!b.running))-(a.busy?2:Number(!!a.running)),
  'status-desc':(a,b)=>(a.busy?2:Number(!!a.running))-(b.busy?2:Number(!!b.running))
 };
 const compare=comparisons[sort]||comparisons.new;
 filtered.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||compare(a,b)||a.id.localeCompare(b.id));
 const size=[10,25,50,100].includes(Number(pageSize))?Number(pageSize):10;
 const pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.max(1,Math.min(pages,Math.trunc(Number(page))||1));
 return {items:filtered.slice((current-1)*size,current*size),ids:filtered.map(p=>p.id),total:filtered.length,pages,page:current,pageSize:size};
}

export function recordPage(records,{query='',profileId='',sort='new',page=1,pageSize=25}={},profiles=[]){
 const names=new Map(profiles.map(p=>[p.id,p.name]));
 const q=normalizeSearch(query).trim();
 const filtered=records.map((record,index)=>({...record,position:index})).filter(r=>(!profileId||r.profileId===profileId)&&normalizeSearch([r.title,r.url,r.notes,names.get(r.profileId)].filter(Boolean).join(' ')).includes(q));
 const compareText=(a,b,key)=>String(a[key]??'').localeCompare(String(b[key]??''),'pt-PT');
 const sorts={new:(a,b)=>compareText(b,a,'at')||b.position-a.position,old:(a,b)=>compareText(a,b,'at')||a.position-b.position,title:(a,b)=>compareText(a,b,'title'),'title-desc':(a,b)=>compareText(b,a,'title'),url:(a,b)=>compareText(a,b,'url'),'url-desc':(a,b)=>compareText(b,a,'url')};
 filtered.sort((a,b)=>(sorts[sort]||sorts.new)(a,b)||String(a.id).localeCompare(String(b.id)));
 const size=[10,25,50,100].includes(Number(pageSize))?Number(pageSize):25,pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.max(1,Math.min(pages,Math.trunc(Number(page))||1));
 return {items:filtered.slice((current-1)*size,current*size),ids:filtered.map(r=>r.id),total:filtered.length,pages,page:current,pageSize:size};
}

export function groupPage(groups,details={},profiles=[],{query='',sort='name',page=1,pageSize=10}={}){
 const counts=new Map();for(const profile of profiles)for(const name of profileGroups(profile))counts.set(name,(counts.get(name)||0)+1);
 const q=normalizeSearch(query).trim();
 const filtered=groups.map(name=>({name,description:details[name]?.description||'',count:counts.get(name)||0})).filter(g=>normalizeSearch(g.name+' '+g.description).includes(q));
 const byName=(a,b)=>a.name.localeCompare(b.name,'pt-PT'),byDescription=(a,b)=>a.description.localeCompare(b.description,'pt-PT');
 const sorts={name:byName,'name-desc':(a,b)=>byName(b,a),count:(a,b)=>b.count-a.count,'count-asc':(a,b)=>a.count-b.count,description:byDescription,'description-desc':(a,b)=>byDescription(b,a)};
 filtered.sort((a,b)=>(sorts[sort]||byName)(a,b)||byName(a,b));
 const size=[10,25,50,100].includes(Number(pageSize))?Number(pageSize):10,pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.max(1,Math.min(pages,Math.trunc(Number(page))||1));
 return {items:filtered.slice((current-1)*size,current*size),names:filtered.map(g=>g.name),total:filtered.length,pages,page:current,pageSize:size};
}
