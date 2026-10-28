/** One owned, terminable calculation. No background process survives cancellation. */
export function startReturnBounds(inputs){
 const worker=new Worker(new URL('./equal-angle-bounds-worker.mjs',import.meta.url),{type:'module'});let settled=false,rejectJob;
 const promise=new Promise((resolve,reject)=>{rejectJob=reject;worker.onmessage=event=>{if(settled)return;settled=true;worker.terminate();event.data?.error?reject(Error(event.data.error)):resolve(event.data.report);};worker.onerror=event=>{if(settled)return;settled=true;worker.terminate();reject(Error(event.message||'Exact return calculation failed.'));};try{worker.postMessage(inputs);}catch(error){settled=true;worker.terminate();reject(error);}});
 return {promise,cancel(){if(settled)return;settled=true;worker.terminate();rejectJob(Error('Exact return calculation cancelled.'));}};
}
