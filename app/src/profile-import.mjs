import {mergeGroups,ensureProfileGroups} from './groups.mjs';
function importState(state,profiles,groups){
 if(state.profiles.length+profiles.length>1000)throw Error('Limite de 1000 perfis.');
 const ids=new Set(state.profiles.map(p=>p.id));
 for(const p of profiles){if(!p.id||ids.has(p.id))throw Error('Identidade de importacao repetida.');ids.add(p.id);}
 // Keep existing profile objects: live browser records hold references to them.
 const next={...state,profiles:[...state.profiles,...profiles],groups:[...state.groups],groupDetails:{...state.groupDetails}};
 mergeGroups(next,groups);ensureProfileGroups(next,profiles);return next;
}
export function commitProfileImport(store,profiles,groups=[]){
 const previous=store.state,next=importState(previous,profiles,groups);
 store.state=next;
 try{store.save();}catch(error){store.state=previous;throw error;}
 return {imported:profiles.length,importedGroups:groups.length};
}
export async function stageProfileImport({store,profiles,groups=[],prepare=async()=>{},discard=async()=>{}}){
 // Preflight before touching the filesystem, and recheck against current state
 // at commit because other operations can finish during asynchronous setup.
 importState(store.state,profiles,groups);
 try{
  await prepare();
  return commitProfileImport(store,profiles,groups);
 }catch(error){
  const cleanup=await Promise.allSettled(profiles.map(profile=>Promise.resolve().then(()=>discard(profile))));
  const failures=cleanup.filter(result=>result.status==='rejected').map(result=>result.reason);
  if(failures.length)throw new AggregateError([error,...failures],'Import failed; temporary profile cleanup incomplete: '+[error,...failures].map(e=>e.message||e).join('; '),{cause:error});
  throw error;
 }
}
