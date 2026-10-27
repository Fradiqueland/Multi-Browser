import {EventEmitter} from 'node:events';
// Chrome reads fd 3 and writes fd 4. No localhost listener or bearer URL exists.
export class CDPPipe extends EventEmitter {
 constructor(child,timeout=15000){
  super();this.child=child;this.timeout=timeout;this.next=0;this.pending=new Map();this.buffer=Buffer.alloc(0);this.closed=false;
  this.write=child.stdio[3];this.read=child.stdio[4];
  this.read.on('data',chunk=>this.receive(chunk));
  this.read.on('end',()=>this.finish());this.read.on('error',()=>this.finish());
  this.write.on('error',()=>this.finish());child.once('exit',()=>this.finish());child.once('error',()=>this.finish());
 }
 receive(chunk){
  this.buffer=Buffer.concat([this.buffer,chunk]);
  if(this.buffer.length>32*1024*1024){this.finish(new Error('Resposta Chromium demasiado grande.'));return;}
  for(let end;(end=this.buffer.indexOf(0))>=0;){
   let message;try{message=JSON.parse(this.buffer.subarray(0,end).toString('utf8'));}catch{this.finish(new Error('Resposta Chromium invalida.'));return;}
   this.buffer=this.buffer.subarray(end+1);
   if(message.id){const p=this.pending.get(message.id);if(!p)continue;this.pending.delete(message.id);clearTimeout(p.timer);if(message.error)p.reject(new Error(p.method+': '+message.error.message));else p.resolve(message.result||{});}
   else if(message.method)this.emit('event',message);
  }
 }
 send(method,params={},sessionId){
  if(this.closed)return Promise.reject(new Error('Ligacao Chromium fechada.'));
  const id=++this.next;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Tempo limite Chromium: '+method));},this.timeout);
   this.pending.set(id,{resolve,reject,timer,method});
   this.write.write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0',error=>{if(error){const p=this.pending.get(id);if(p){this.pending.delete(id);clearTimeout(timer);reject(new Error('Ligacao Chromium indisponivel.'));}}});
  });
 }
 finish(error=new Error('Ligacao Chromium fechada.')){
  if(this.closed)return;this.closed=true;
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();this.buffer=Buffer.alloc(0);
  // Release both Windows pipe handles: Chromium may be waiting for input EOF during shutdown.
  this.write.destroy();this.read.destroy();this.emit('closed');
 }
}
