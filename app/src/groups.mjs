// Shared by the manager, storage and import/export; no browser or Node authority.
export function groupNames(values){
 if(!Array.isArray(values)||values.length>1000)throw Error('Lista de grupos inválida.');
 const result=[];for(const value of values){if(typeof value!=='string')throw Error('Nome de grupo inválido.');const name=value.trim();if(!name)continue;if(name.length>60||/[\0\r\n]/.test(name))throw Error('Nome de grupo inválido (máximo de 60 caracteres).');if(!result.includes(name))result.push(name);}return result;
}
export function profileGroups(profile){return groupNames(Array.isArray(profile?.groups)?profile.groups:profile?.group?[profile.group]:[]);}
export function setProfileGroups(profile,groups){profile.groups=groupNames(groups);profile.group=profile.groups[0]||'';return profile;}
export function ensureProfileGroups(state,profiles){for(const p of profiles){setProfileGroups(p,profileGroups(p));for(const name of p.groups)if(!state.groups.includes(name))state.groups.push(name);}if(state.groups.length>1000)throw Error('Limite de 1000 grupos.');}
export function groupRecords(state,names=state.groups){return groupNames(names).map(name=>({name,description:Object.hasOwn(state.groupDetails||{},name)?state.groupDetails[name].description||'':''}));}
export function validateGroupRecords(records=[]){
 if(!Array.isArray(records)||records.length>1000)throw Error('Lista de grupos inválida.');const seen=new Set();
 return records.map(record=>{if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Grupo inválido.');const name=groupNames([record.name])[0];if(!name||seen.has(name))throw Error('Grupo vazio ou repetido no ficheiro.');seen.add(name);const description=record.description??'';if(typeof description!=='string'||description.length>1000||description.includes('\0'))throw Error('Descrição de grupo inválida.');return {name,description};});
}
export function mergeGroups(state,records=[]){state.groupDetails??={};for(const {name,description} of validateGroupRecords(records)){if(!state.groups.includes(name))state.groups.push(name);Object.defineProperty(state.groupDetails,name,{value:{description},enumerable:true,writable:true,configurable:true});}if(state.groups.length>1000)throw Error('Limite de 1000 grupos.');}
export function removeGroups(state,names){const removed=new Set(names);state.groups=state.groups.filter(name=>!removed.has(name));for(const p of state.profiles)setProfileGroups(p,profileGroups(p).filter(name=>!removed.has(name)));for(const name of removed)delete state.groupDetails[name];}
