const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
 request:(action,data={})=>ipcRenderer.invoke('multi-browser',action,data),
 subscribe:(callback)=>{const listener=(_e,value)=>callback(value);ipcRenderer.on('workspace-changed',listener);return()=>ipcRenderer.removeListener('workspace-changed',listener);}
});
