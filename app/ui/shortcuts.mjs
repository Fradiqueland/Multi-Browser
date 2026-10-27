// Shared by trusted toolbar DOM events and Electron before-input-event.
export function primaryShortcut(event,platform){
 return !(event.altKey??event.alt)&&Boolean(platform==='darwin'?(event.metaKey??event.meta):(event.ctrlKey??event.control));
}
