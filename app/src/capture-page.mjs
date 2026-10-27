import {bounded} from './operations.mjs';
export async function capturePage(contents){
 for(let attempt=0;attempt<3;attempt++){
  try{return await bounded(contents.capturePage(),'capturar interface',5000);}
  catch(error){if(!String(error.message||error).includes('UnknownVizError')||attempt===2)throw error;}
  await new Promise(resolve=>setTimeout(resolve,150*(attempt+1)));
 }
}
