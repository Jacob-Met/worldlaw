import {freezeDurationAcquisition,receiveDurationAcquisition,exportDurationAcquisition,importDurationAcquisition} from './duration-acquisition.mjs';
const $=id=>document.getElementById('duration-request-'+id);
export function mountDurationAcquisition(controller,getPlan){
 let request=null,result=null,generation=0,adopting=false;
 const download=(value,name)=>{const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const safe=fn=>{try{fn();$('error').textContent='';}catch(e){$('error').textContent=e.message;}};
 function render(){
  $('template').disabled=!request||!!result;$('save').disabled=!request;$('observation').disabled=!request||!!result;
  $('status').textContent=!request?'No request frozen.':result?
   request.protocol.runId+': '+result.qualification.status.toUpperCase()+'. Actual contrast radius '+result.qualification.actualRadius.toPrecision(5)+' N·m; planned '+result.qualification.plannedRadius+' N·m. '+result.qualification.reasons.join(' ')+' All frozen model outcomes appear in the duration comparison above.':
   'FROZEN: '+request.protocol.runId+' · '+request.protocol.duration+' s · '+request.protocol.pairs+' pairs · '+request.protocol.source+'. '+request.protocol.preparation+' Download the template and supply actual paired observations; no readings have been generated.';
 }
 document.addEventListener('worldlaw-duration-study-change',()=>{if(adopting)return;generation++;request=null;result=null;render();});
 $('freeze').onclick=()=>safe(()=>{const plan=getPlan();if(!plan?.selected)throw Error('Compute an informative duration plan first.');const next=freezeDurationAcquisition(controller.getStudy(),plan.settings,{runId:$('id').value,preparation:$('preparation').value});controller.beginOperation();generation++;request=next;result=null;render();});
 $('template').onclick=()=>safe(()=>{if(!request||result)throw Error('Freeze an unreceived request first.');download(JSON.stringify({protocol:request.protocol,run:{id:request.protocol.runId,role:'challenge',duration:request.protocol.duration,notebook:{schema:'worldlaw.history-challenge/v1',source:request.protocol.source,sourceNote:'',noiseSigma:null,trials:[]}}},null,2)+'\n','worldlaw-duration-observation-template.json');});
 $('save').onclick=()=>safe(()=>{if(!request)throw Error('Freeze a request first.');download(exportDurationAcquisition(request,result?.observation??null),'worldlaw-duration-acquisition.json');});
 async function load(input,opening){
  const file=input.files?.[0];if(!file)return;const token=++generation,revision=controller.beginOperation();
  try{
   if(file.size>5000000)throw Error('Use JSON below 5 MB.');const text=await file.text();if(token!==generation||!controller.isCurrentOperation(revision))return;
   let nextRequest,nextResult;
   if(opening){const restored=importDurationAcquisition(text);nextRequest=restored.request;nextResult=restored.result;}
   else{if(!request||result)throw Error('Freeze an unreceived request first.');nextRequest=request;nextResult=receiveDurationAcquisition(request,JSON.parse(text),controller.getStudy());}
   adopting=true;try{controller.adopt(nextResult?.study??nextRequest.study);}finally{adopting=false;}
   request=nextRequest;result=nextResult;render();$('error').textContent='';
  }catch(e){if(token===generation&&controller.isCurrentOperation(revision))$('error').textContent=e.message;}
  finally{if(token===generation)input.value='';}
 }
 $('observation').onchange=()=>load($('observation'),false);$('open').onchange=()=>load($('open'),true);render();
}
