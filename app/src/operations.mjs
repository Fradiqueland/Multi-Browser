export async function bounded(operation, label, timeoutMs = 15000) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Tempo limite: ' + label + ' (' + timeoutMs + ' ms)')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function closeWindow(window, label = 'fechar janela', timeoutMs = 10000) {
  if (!window || window.isDestroyed()) return;
  let onClosed;
  const closed = new Promise(resolve => {
    onClosed = resolve;
    window.once('closed', onClosed);
  });
  try {
    window.close();
    await bounded(closed, label, timeoutMs);
  } finally {
    window.removeListener('closed', onClosed);
  }
}

export async function closeHTTPServer(server, label = 'fechar servidor HTTP', timeoutMs = 5000) {
  if (!server?.listening) return;
  await bounded(new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }), label, timeoutMs);
}

export async function closeWebContents(contents,label='fechar documento',timeoutMs=10000){
 if(!contents||contents.isDestroyed())return;
 const destroyed=new Promise(resolve=>contents.once('destroyed',resolve));
 if(contents.debugger.isAttached())contents.debugger.detach();
 contents.close({waitForBeforeUnload:false});
 await bounded(destroyed,label,timeoutMs);
}

export async function until(predicate,label='aguardar resultado',timeoutMs=15000){
 const deadline=performance.now()+timeoutMs;
 for(;;){
  const remaining=deadline-performance.now();
  if(remaining<=0)throw Error('Tempo limite: '+label+' ('+timeoutMs+' ms)');
  const value=await bounded(Promise.resolve().then(predicate),label,remaining);
  if(value)return value;
  await new Promise(resolve=>setTimeout(resolve,Math.min(40,Math.max(1,deadline-performance.now()))));
 }
}

export async function openProfileBatch(profiles,open,limit=10){
 const selected=profiles.slice(0,limit),failed=[];let opened=0;
 for(const profile of selected){try{await open(profile.id);opened++;}catch(error){failed.push({id:profile.id,name:profile.name,error:String(error.message||error)});}}
 return {opened,failed,requested:profiles.length,attempted:selected.length,limited:profiles.length>limit};
}

// Complete every owned operation before surfacing failures.
export async function settleOperations(operations,label='Concluir operacoes'){
 const results=await Promise.allSettled(operations.map(operation=>Promise.resolve().then(operation)));
 const failures=results.filter(result=>result.status==='rejected').map(result=>result.reason);
 if(failures.length)throw new AggregateError(failures,label+': '+failures.map(error=>String(error?.message||error)).join('; '));
 return results.map(result=>result.value);
}
