export const DEFAULT_LANGUAGE='en';
export const LANGUAGES=[{id:'en',name:'English'},{id:'pt',name:'Português (Portugal)'},{id:'es',name:'Español'},{id:'fr',name:'Français'},{id:'hi',name:'हिन्दी'},{id:'ar',name:'العربية'},{id:'zh',name:'中文（简体）'},{id:'bn',name:'বাংলা'},{id:'ru',name:'Русский'},{id:'id',name:'Bahasa Indonesia'},{id:'it',name:'Italiano'}];
export function validLanguage(value){return value==='pt-PT'||LANGUAGES.some(language=>language.id===value);}
export function normalizeLanguage(value){return value==='pt-PT'?'pt':validLanguage(value)?value:DEFAULT_LANGUAGE;}
export function languageDirection(value){return normalizeLanguage(value)==='ar'?'rtl':'ltr';}
