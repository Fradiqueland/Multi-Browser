export function installLanguage(locale) {
 const prototype=globalThis.Navigator?.prototype||globalThis.WorkerNavigator?.prototype;
 if(!prototype)return;
 const languages=Object.freeze([...new Set([locale,locale.split('-')[0]])]);
 for(const [name,value] of [['language',locale],['languages',languages]]) {
  try{Object.defineProperty(prototype,name,{configurable:true,get:()=>value});}catch{}
 }
}
export function languageSource(locale) {return '('+installLanguage.toString()+')('+JSON.stringify(locale)+');';}
export function userAgentOverride(userAgent,locale) {
 const result={userAgent,acceptLanguage:locale};
 const version=userAgent.match(/(?:Chrome|Chromium)\/([\d.]+)/)?.[1];
 if(!version)return result;
 const android=/Android/.test(userAgent),mobile=/Mobile/.test(userAgent);
 const platform=android?'Android':/Windows/.test(userAgent)?'Windows':/Macintosh/.test(userAgent)?'macOS':'Linux';
 result.platform=android?'Linux armv8l':platform==='Windows'?'Win32':platform==='macOS'?'MacIntel':'Linux x86_64';
 const fullVersionList=[{brand:'Chromium',version}];
 if(/Edg\//.test(userAgent))fullVersionList.push({brand:'Microsoft Edge',version:userAgent.match(/Edg\/([\d.]+)/)[1]});
 else if(/Chrome\//.test(userAgent))fullVersionList.push({brand:'Google Chrome',version});
 result.userAgentMetadata={brands:fullVersionList.map(x=>({brand:x.brand,version:x.version.split('.')[0]})),fullVersionList,fullVersion:version,platform,platformVersion:android?(userAgent.match(/Android ([\d.]+)/)?.[1]||''):platform==='Windows'?'10.0.0':'',architecture:android?'arm':'x86',model:android?(userAgent.match(/Android [^;]+;\s*([^;)]+)/)?.[1]||''):'',mobile,bitness:/Win64|x64|x86_64|Macintosh/.test(userAgent)?'64':'',wow64:false};
 return result;
}

export function installWorkerUserAgent(override){
 const prototype=globalThis.WorkerNavigator?.prototype;if(!prototype||!override?.userAgent)return;
 const getter=(name,value)=>{try{Object.defineProperty(prototype,name,{configurable:true,get:()=>value});}catch{}};
 getter('userAgent',override.userAgent);getter('appVersion',override.userAgent.replace(/^Mozilla\//,''));
 if(override.platform)getter('platform',override.platform);
 const metadata=override.userAgentMetadata;
 if(metadata&&'userAgentData' in navigator){
  const brands=Object.freeze(metadata.brands.map(brand=>Object.freeze({...brand}))),low=()=>({brands:brands.map(brand=>({...brand})),mobile:metadata.mobile,platform:metadata.platform});
  const high={architecture:metadata.architecture,bitness:metadata.bitness,model:metadata.model,platformVersion:metadata.platformVersion,uaFullVersion:metadata.fullVersion,fullVersionList:metadata.fullVersionList,wow64:metadata.wow64};
  const value={brands,mobile:metadata.mobile,platform:metadata.platform,toJSON:()=>low(),getHighEntropyValues:async hints=>{const result=low();for(const hint of hints)if(Object.hasOwn(high,hint))result[hint]=hint==='fullVersionList'?high[hint].map(brand=>({...brand})):high[hint];return result;}};
  getter('userAgentData',Object.freeze(value));
 }
}
