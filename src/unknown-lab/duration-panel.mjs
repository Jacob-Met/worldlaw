import {DURATION_SCHEMA,analyzeDurationStudy,exportDurationStudy,importDurationStudy} from './duration-response.mjs';
import {syntheticChallenge} from './paired-history.mjs';
const $=id=>document.getElementById(id),fmt=n=>Number(n.toPrecision(4)).toString();
export function mountDurationPanel(currentNotebook){
 let study={schema:DURATION_SCHEMA,runs:[]};
 const attempt=fn=>{try{fn();$('duration-error').textContent='';}catch(e){$('duration-error').textContent=e.message;}};
 const download=()=>{
  const url=URL.createObjectURL(new Blob([exportDurationStudy(study)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='worldlaw-duration-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 function adopt(next){const result=analyzeDurationStudy(next);study=next;render(result);document.dispatchEvent(new Event('worldlaw-duration-study-change'));}
 function render(result){
  $('duration-state').textContent=result.fit.status.toUpperCase().replaceAll('-',' ');
  $('duration-summary').textContent=result.fit.reasons.join(' ')||'Frozen training hypotheses: '+result.fit.candidates.filter(c=>c.compatible).length+' / '+result.fit.candidates.length+'. Challenge results never refit or rerank these parameters.';
  const body=$('duration-models');body.replaceChildren();
  for(const c of result.fit.candidates){
   const tr=document.createElement('tr');
   for(const value of [c.id,c.compatible?'compatible':'contradicted',c.amplitudeInterval?c.amplitudeInterval.map(fmt).join(' to ')+' N·m':'—']){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
  }
  const list=$('duration-runs');list.replaceChildren();
  for(const run of study.runs){
   const li=document.createElement('li');li.textContent=run.id+' · '+run.role+' · '+run.duration+' s · '+run.notebook.source+' ';
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+run.id);
   remove.onclick=()=>attempt(()=>adopt({...study,runs:study.runs.filter(r=>r.id!==run.id)}));li.append(remove);list.append(li);
  }
  const challenges=$('duration-challenges');challenges.replaceChildren();
  for(const c of result.challenges){
   const p=document.createElement('p');p.textContent=c.id+' at '+c.duration+' s: observed '+fmt(c.observed)+' N·m; '+(c.predictions.length?c.predictions.map(x=>x.id+' predicts ['+x.interval.map(fmt).join(', ')+'] — '+x.status).join('; '):'no qualified training hypothesis');challenges.append(p);
  }
  if(result.challenges.length){
   const p=document.createElement('p');p.textContent='One shared amplitude across ALL separate challenges: '+result.jointChallenges.map(c=>c.id+' — '+c.status).join('; ')+'. No challenge-specific parameter switching; plotted predictions remain frozen.';challenges.append(p);
  }
  draw(result);
 }
 function draw(result){
  const svg=$('duration-plot'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();
  const points=[...result.fit.points.map(p=>({duration:p.duration,interval:p.interval,observed:p.decisionDifference,training:true})),...result.challenges];
  if(!points.length)return;
  const maxT=Math.max(1,...points.map(p=>p.duration)),low=Math.min(0,...points.map(p=>p.interval[0])),high=Math.max(.1,...points.map(p=>p.interval[1])),pad=(high-low)*.1;
  const X=t=>65+t/maxT*690,Y=v=>225-(v-low+pad)/(high-low+2*pad)*195;
  const node=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;};
  for(let i=0;i<=4;i++){const t=maxT*i/4;node('line',{x1:X(t),x2:X(t),y1:25,y2:230,stroke:'#315460'});node('text',{x:X(t),y:253,fill:'#a5cbd0','text-anchor':'middle'},fmt(t)+' s');}
  for(const c of result.fit.candidates.filter(c=>c.compatible)){
   const coords=Array.from({length:61},(_,i)=>{const t=maxT*i/60,x=c.family==='memoryless'?0:c.family==='constant'?1:-Math.expm1(-t/c.tau);return [X(t),Y(x*(c.amplitudeInterval[0]+c.amplitudeInterval[1])/2)];});
   node('polyline',{points:coords.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#7998dd','stroke-width':2,opacity:.7});
  }
  for(const p of points){const color=p.training?'#5df5df':'#ffad5c';node('line',{x1:X(p.duration),x2:X(p.duration),y1:Y(p.interval[0]),y2:Y(p.interval[1]),stroke:color,'stroke-width':3});node('circle',{cx:X(p.duration),cy:Y(p.observed),r:5,fill:color});}
  node('text',{x:15,y:18,fill:'#a5cbd0'},'Contrast N·m · cyan training / amber challenge · curves = interval midpoints');
 }
 for(const role of ['training','challenge'])$('duration-add-'+role).onclick=()=>attempt(()=>{
  const notebook=currentNotebook(),value=$('duration-value').value;
  if(!value.trim())throw Error('Declare the acquisition conditioning duration.');
  const duration=notebook.simulation?.duration??Number(value);
  const id='run-'+(Date.now())+'-'+study.runs.length;
  adopt({...study,runs:[...study.runs,{id,role,duration,notebook}]});
 });
 $('duration-example').onclick=()=>attempt(()=>{
  const runs=[.3,1,3,.6,2,6].map((duration,i)=>({id:'virtual-'+i,duration,role:i<3?'training':'challenge',notebook:syntheticChallenge({duration,count:32,seed:101+i*19,noiseSigma:.003,effect:.7})}));
  adopt({schema:DURATION_SCHEMA,runs});
 });
 $('duration-clear').onclick=()=>attempt(()=>adopt({schema:DURATION_SCHEMA,runs:[]}));
 $('duration-export').onclick=()=>attempt(download);
 $('duration-open').onclick=()=>$('duration-file').click();
 $('duration-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>4000000)throw Error('Use JSON below 4 MB.');const next=importDurationStudy(await file.text());adopt(next);$('duration-error').textContent='';}catch(error){$('duration-error').textContent=error.message;}finally{e.target.value='';}};
 render(analyzeDurationStudy(study));
 return {getStudy:()=>structuredClone(study),adopt};
}
