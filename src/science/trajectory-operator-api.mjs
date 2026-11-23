import {Worker} from 'node:worker_threads';
import {MIMEType} from 'node:util';
let running=false;
const MAX_BYTES=4_000_000;
export async function handleTrajectoryOperators(req,res) {
  const json=(status,body)=>{if(!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}};
  if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'}).end('Use POST.');return;}
  let type;try{type=new MIMEType(String(req.headers['content-type']||'')).essence;}catch{type=null;}
  if(type!=='application/json'){json(415,{error:'Send application/json.'});return;}
  if(running){json(429,{error:'A trajectory fit is already running.'});return;}
  running=true;
  try {
    const chunks=[];let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BYTES){json(413,{error:'State observations exceed the request budget.'});req.destroy();return;}chunks.push(chunk);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{json(400,{error:'Request body is not valid JSON.'});return;}
    if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['training','selection','options','plans'].includes(k))){json(400,{error:'Send training, selection and optional options and plans.'});return;}
    const result=await new Promise(resolve=>{
      const worker=new Worker(new URL('./trajectory-operator-worker.mjs',import.meta.url),{workerData:input,resourceLimits:{maxOldGenerationSizeMb:512}});
      let settled=false;
      const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();resolve(result);};
      const timer=setTimeout(()=>finish({ok:false,status:503,error:'Trajectory fitting exceeded its time budget.'}),60000);
      worker.once('message',finish);
      worker.once('error',()=>finish({ok:false,status:503,error:'Trajectory worker failed.'}));
      worker.once('exit',()=>{if(!settled)finish({ok:false,status:503,error:'Trajectory worker ended without a result.'});});
    });
    json(result.ok?200:result.status||400,result.ok?result.result:{error:result.error});
  } catch {
    json(400,{error:'Could not read the state observations.'});
  } finally {running=false;}
}
