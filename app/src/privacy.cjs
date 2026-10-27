// This function is serialized into the page by CDP. It contains no Node or IPC references.
function installPrivacy(options){
 const deny=feature=>{throw new DOMException(feature+' desativado neste perfil.','NotSupportedError');};
 const replace=(object,name,value)=>{if(object)try{Object.defineProperty(object,name,{configurable:false,writable:false,value});}catch{}};
 if(options.webgl){
  for(const prototype of [globalThis.HTMLCanvasElement?.prototype,globalThis.OffscreenCanvas?.prototype]){
   if(!prototype?.getContext)continue;
   const original=prototype.getContext;
   replace(prototype,'getContext',function(type,...args){return /^(webgl2?|experimental-webgl)$/i.test(String(type))?null:original.call(this,type,...args);});
  }
 }
 if(options.canvas){
  replace(globalThis.HTMLCanvasElement?.prototype,'toDataURL',function(){return deny('Leitura de canvas');});
  replace(globalThis.HTMLCanvasElement?.prototype,'toBlob',function(){return deny('Leitura de canvas');});
  replace(globalThis.CanvasRenderingContext2D?.prototype,'getImageData',function(){return deny('Leitura de canvas');});
  replace(globalThis.OffscreenCanvas?.prototype,'convertToBlob',function(){return Promise.reject(new DOMException('Leitura de canvas desativada.','NotSupportedError'));});
  replace(globalThis.OffscreenCanvasRenderingContext2D?.prototype,'getImageData',function(){return deny('Leitura de canvas');});
 }
 if(options.audio)for(const key of ['AudioContext','webkitAudioContext','OfflineAudioContext','webkitOfflineAudioContext'])if(key in globalThis)replace(globalThis,key,function(){return deny('AudioContext');});
 if(options.webrtc)for(const key of ['RTCPeerConnection','webkitRTCPeerConnection','RTCDataChannel'])if(key in globalThis)replace(globalThis,key,function(){return deny('WebRTC');});
 if(options.fonts){
  if('queryLocalFonts' in globalThis)replace(globalThis,'queryLocalFonts',function(){return Promise.reject(new DOMException('Enumeração de fontes desativada.','NotAllowedError'));});
  // Deliberately limit font-availability probes; ordinary text rendering is retained.
  if(globalThis.FontFaceSet?.prototype?.check)replace(globalThis.FontFaceSet.prototype,'check',function(){return false;});
 }
}
module.exports={installPrivacy};
