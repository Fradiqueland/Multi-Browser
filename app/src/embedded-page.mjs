import {bounded,until} from './operations.mjs';
import {languageSource,userAgentOverride} from './identity.mjs';
import privacyPackage from './privacy.cjs';
// Start an inert document to create Chromium's target, then configure through CDP.
// Do not wait for Electron's initial did-finish-load/executeJavaScript load gate.
// The caller may navigate to an external page only after this operation resolves.
export async function prepareEmbeddedPage(contents,profile,bounds,{timeout=15000,trace=()=>{}}={}){
 let active=true,stage='attach';
 const send=async(method,params={})=>{
  if(!active||contents.isDestroyed())throw Error('Page initialization cancelled.');
  stage=method;trace(stage);return contents.debugger.sendCommand(method,params);
 };
 const initialLoad=contents.loadURL('about:blank');
 const initialFailure=new Promise((_,reject)=>initialLoad.catch(error=>{if(error.code!=='ERR_ABORTED'&&error.errno!==-3)reject(error);}));
 const configure=async()=>{
  contents.debugger.attach('1.3');
  await send('Page.enable');
  await send('Emulation.setLocaleOverride',{locale:profile.locale});
  if(profile.userAgent)await send('Emulation.setUserAgentOverride',userAgentOverride(profile.userAgent,profile.locale));
  if(profile.timezone&&profile.timezoneEnabled!==false)await send('Emulation.setTimezoneOverride',{timezoneId:profile.timezone});
  if(profile.geolocation&&profile.geolocationEnabled!==false)await send('Emulation.setGeolocationOverride',profile.geolocation);
  if(profile.emulateScreen)await send('Emulation.setDeviceMetricsOverride',{width:bounds.width,height:bounds.height,deviceScaleFactor:1,mobile:false,screenWidth:profile.width,screenHeight:profile.height});
  const source=languageSource(profile.locale)+(Object.values(profile.privacy||{}).some(Boolean)?'('+privacyPackage.installPrivacy.toString()+')('+JSON.stringify(profile.privacy)+');':'');
  await send('Page.addScriptToEvaluateOnNewDocument',{source,runImmediately:true});
 };
 try{await bounded(Promise.race([configure(),initialFailure]),'preparar pagina',timeout);}catch(error){throw Error('Page initialization failed at '+stage+': '+error.message,{cause:error});}finally{active=false;}
}

export async function navigatePreparedPage(tab,url){
 const navigation={cancelled:false};tab.pendingNavigation=navigation;
 await tab.ready;
 const contents=tab.view.webContents;
 if(navigation.cancelled||tab.pendingNavigation!==navigation||contents.isDestroyed())return;
 try{await contents.loadURL(url);}catch(error){if(!navigation.cancelled&&error.code!=='ERR_ABORTED'&&error.errno!==-3)throw error;}
 // Electron can resolve loadURL on the preceding about:blank completion.
 // Keep the current request pending until Chromium actually stops loading.
 await until(()=>navigation.cancelled||tab.pendingNavigation!==navigation||contents.isDestroyed()||!contents.isLoading(),'concluir navegacao atual',30000);
}
