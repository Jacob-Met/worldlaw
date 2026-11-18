import {schedulePortObservations} from './actuator-port.mjs';
import {planProspectivePortIntervention,receiveProspectivePortObservation} from './prospective-port.mjs';

const NS='http://www.w3.org/2000/svg';
const $=(root,key)=>root.querySelector('[data-prospective="'+key+'"]');
const text=(v,d=3)=>Number(v).toFixed(d);
function node(tag,attributes={},label){
  const e=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attributes))e.setAttribute(k,String(v));
  if(label!==undefined)e.textContent=label;
  return e;
}
function draw(root,proposal){
  const plot=$(root,'plot');plot.replaceChildren();
  const selected=proposal.selected;
  if(!selected?.observationIndex){plot.hidden=true;return;}
  plot.hidden=false;
  const {drive,observationIndex}=selected;
  const initial=proposal.source.initial;
  const predictions=schedulePortObservations(drive,0,initial,.5,.0025).predictions.slice(0,observationIndex);
  const width=640,left=56,right=606,top=26,mid=120,bottom=308;
  const xs=t=>left+(right-left)*t/proposal.source.settings.durationSeconds;
  const amplitude=proposal.source.settings.amplitudeCapNm;
  const yTorque=t=>72-37*t/amplitude;
  for(let i=-1;i<=1;i++)plot.append(node('line',{x1:left,x2:right,y1:yTorque(i*amplitude),y2:yTorque(i*amplitude),stroke:'#53687c','stroke-width':1,'stroke-dasharray':'3 5'}));
  plot.append(node('polyline',{points:drive.map(p=>xs(p.time)+','+yTorque(p.torque)).join(' '),fill:'none',stroke:'#f8c779','stroke-width':3,'stroke-linejoin':'round'}));
  plot.append(node('text',{x:left,y:16,fill:'#f8c779','font-size':13},'PRECOMMITTED COMMAND · N·m'));
  const clock=selected.observationTime;
  plot.append(node('line',{x1:xs(clock),x2:xs(clock),y1:30,y2:mid-3,stroke:'#fff','stroke-width':1.5,'stroke-dasharray':'4 3'}));
  const vectors=[initial.slice(0,2),...predictions.flatMap(p=>[p.shoulder,p.elbow])];
  const limits=[0,1].map(i=>[Math.min(...vectors.map(v=>v[i])),Math.max(...vectors.map(v=>v[i]))]);
  const span=Math.max(.04,...limits.map(([lo,hi])=>hi-lo))*1.36;
  const center=limits.map(([lo,hi])=>(lo+hi)/2);
  const xy=point=>[width/2+445*(point[0]-center[0])/span,220-165*(point[1]-center[1])/span];
  const origin=xy(initial);
  plot.append(node('line',{x1:left,x2:right,y1:220,y2:220,stroke:'#53687c','stroke-dasharray':'2 6'}));
  plot.append(node('line',{x1:width/2,x2:width/2,y1:137,y2:bottom,stroke:'#53687c','stroke-dasharray':'2 6'}));
  for(const [port,stroke,dashed] of [['shoulder','#ffbf68',true],['elbow','#79dfdb',false]]){
    const points=[initial.slice(0,2),...predictions.map(p=>p[port])].map(xy);
    plot.append(node('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke,'stroke-width':3,...(dashed?{'stroke-dasharray':'8 5'}:{})}));
    const [x,y]=points.at(-1);plot.append(node('circle',{cx:x,cy:y,r:6,fill:stroke,stroke:'#101c2d','stroke-width':1.5}));
  }
  plot.append(node('circle',{cx:origin[0],cy:origin[1],r:5,fill:'none',stroke:'#cbd7e5','stroke-width':2}));
  plot.append(node('text',{x:left,y:143,fill:'#cbd7e5','font-size':13},'FORECAST ANGLE PLANE · rad'));
  plot.append(node('text',{x:right,y:330,fill:'#a8bccc','text-anchor':'end','font-size':12},'Horizontal shoulder angle · vertical elbow angle'));
  const [a,b]=[selected.predicted.shoulder,selected.predicted.elbow].map(xy);
  plot.append(node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#fff','stroke-width':1.5,'stroke-dasharray':'2 3'}));
}
function download(value,name) {
  const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function mountProspectivePort(root) {
  let plan=null,version=0;
  const source=()=>{
    const numeric=name=>{const field=$(root,name);if(!field.value.trim())throw Error('Complete '+name+' before planning.');return Number(field.value);};
    return {initial:['q1','q2','v1','v2'].map(numeric),
      settings:{amplitudeCapNm:numeric('amplitude'),impulseCapNms:numeric('impulse'),
      maxSlewNmPerSecond:numeric('slew'),contrastRadiusRad:numeric('radius'),
      durationSeconds:numeric('duration'),stepSeconds:numeric('step')}};
  };
  const invalidate=()=>{
    plan=null;version++;$(root,'save').disabled=true;$(root,'sample').disabled=true;
    $(root,'plot').hidden=true;$(root,'evidence').hidden=true;
    $(root,'result').textContent='A changed initial state or constraint invalidates the previous command and clock.';
  };
  root.querySelectorAll('input[data-prospective-source]').forEach(i=>i.addEventListener('input',invalidate));
  function planNow(){
    try{
      const next=planProspectivePortIntervention(source());plan=next;
      $(root,'save').disabled=false;
      $(root,'error').textContent='';
      const s=next.selected;
      $(root,'sample').disabled=next.status!=='prospective-witness';
      $(root,'evidence').hidden=next.status!=='prospective-witness';
      if(next.status==='prospective-witness'){
        $(root,'result').textContent='A precommitted '+text(1000*s.observationTime,0)+' ms encoder snapshot separates the two offered forecasts by '+text(s.predicted.separation,4)+' rad; conservatively screened margin '+text(s.predicted.certifiedMargin,4)+' rad. '+next.candidateCount+' admissible commands were examined.';
        $(root,'clock').textContent=text(1000*s.observationTime,0)+' ms (fixed before measurement)';
        $(root,'torque').textContent='Max slew '+text(s.peakSlewNmPerSecond,1)+' N·m/s · absolute impulse '+text(s.impulseNms,4)+' N·m·s';
      }else{
        $(root,'result').textContent=next.status+': No distinguishing measurement can be promised under these declared limits. No actuator is commanded.';
      }
      draw(root,next);
    }catch(e){invalidate();$(root,'error').textContent=e.message;}
  }
  $(root,'form').addEventListener('submit',e=>{e.preventDefault();planNow();});
  $(root,'save').addEventListener('click',()=>{
    if(plan)download(plan,'worldlaw-prospective-port-plan.json');
  });
  $(root,'sample').addEventListener('click',()=>{
    if(!plan?.selected?.predicted)return;
    const p=plan.selected.predicted;
    $(root,'angle1').value=p.shoulder[0];
    $(root,'angle2').value=p.shoulder[1];
    $(root,'result').textContent='SIMULATION PREVIEW ONLY: inserted shoulder-model forecast, NOT a new encoder measurement. To claim a measured result, supply an independently logged command trace and actual angles.';
  });
  $(root,'evidence-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const intent=++version;
    try{
      if(!plan||plan.status!=='prospective-witness')throw Error('Freeze a distinguishing command before receiving measurements.');
      const file=$(root,'trace').files?.[0];
      if(!file||file.size>1000000)throw Error('Import an independently logged command trace JSON below 1 MB.');
      const raw=JSON.parse(await file.text());
      if(intent!==version)return;
      if(!Array.isArray(raw))throw Error('The delivered command JSON must be an array of time/torque pairs.');
      const angles=[$(root,'angle1'),$(root,'angle2')].map(x=>{
        if(!x.value.trim())throw Error('Enter both actual encoder angles.');return Number(x.value);
      });
      const result=receiveProspectivePortObservation(plan,raw,{time:plan.selected.observationTime,position:angles});
      $(root,'result').textContent=(result.status==='model-inadequate'?'NEITHER PORT EXPLAINS THE OBSERVATION':result.status==='ambiguous'?'BOTH PORTS REMAIN POSSIBLE':result.status.toUpperCase()+' PORT CONDITIONALLY CONSISTENT')+
        '. Residuals: shoulder '+text(result.shoulderResidualRad,4)+' rad; elbow '+text(result.elbowResidualRad,4)+' rad; assumed acceptance radius '+text(result.declaredAcceptanceRadiusRad,4)+' rad. The imported command and encoder readings are user-declared, not authenticated physical evidence.';
      $(root,'error').textContent='';
    }catch(error){if(intent===version)$(root,'error').textContent=error.message;}
  });
  planNow();
}
