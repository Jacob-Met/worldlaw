import {analyzeFamilyRefinement} from './reference-family-refinement.mjs';
export const FAMILY_WORKER_URL=new URL('./reference-family-worker.mjs',import.meta.url);
if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope){
 globalThis.onmessage=event=>{try{globalThis.postMessage({ok:true,report:analyzeFamilyRefinement(event.data)});}catch(error){globalThis.postMessage({ok:false,error:error.message});}};
}
