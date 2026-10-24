import {analyzeContinuousDurationStudy,exportContinuousInvestigation,importContinuousInvestigation} from './continuous-duration.mjs';
import {continuousDurationExample} from './continuous-duration-example.mjs';
const $=id=>document.getElementById(id),fmt=x=>Number(x.toPrecision(5)).toString();
export function mountContinuousDuration(controller){
 let report=null,epoch=0;
 const invalidate=()=>{epoch++;report=null;$('continuous-export').disabled=true;$('continuous-status').textContent='Recompute this comparison from the current input study and declared parameter bounds.';$('continuous-boxes').replaceChildren();$('continuous-witnesses').replaceChildren();$('continuous-plot').replaceChildren();$('continuous-challenges').textContent='';$('continuous-plot-note').textContent='';};
 const safe=fn=>{try{fn();$('continuous-error').textContent='';}catch(e){$('continuous-error').textContent=e.message;}};
 function settings(){const read=id=>{if(!$(id).value.trim())throw Error('Complete every numerical search bound.');return Number($(id).value);};return {tauMin:read('continuous-min'),tauMax:read('continuous-max'),tauResolution:read('continuous-resolution'),maxBoxes:read('continuous-budget')};}
 function render(next){
  report=next;const f=next.fit,range=f.boxes.length?[Math.min(...f.boxes.map(b=>b.tau[0])),Math.max(...f.boxes.map(b=>b.tau[1]))]:null;
  $('continuous-status').textContent=(next.source==='measured'?'USER-DECLARED MEASURED INPUTS · ':'DECLARED SYNTHETIC INPUTS · ')+f.status.toUpperCase().replaceAll('-',' ')+' · finite baseline: '+f.finiteBaseline.status+'. '+f.evaluatedBoxes+'/'+f.settings.maxBoxes+' training box evaluations; '+f.boxes.length+' possible outer boxes; '+f.witnesses.length+' actual coherent witnesses. '+(range?'Outer tau span '+range.map(fmt).join(' to ')+' s. ':'')+(f.budgetExhausted?'Budget exhausted: unvisited regions are retained, not rejected. ':f.zeroCompatible?'Zero response is compatible throughout the offered tau range; tau is unidentified. ':'');
  for(const [target,values,format]of [['continuous-boxes',f.boxes,b=>[b.tau.map(fmt).join(' to '),b.amplitude.map(fmt).join(' to '),b.resolutionMet?'requested resolution':'unresolved / retained']],['continuous-witnesses',f.witnesses,w=>[fmt(w.tau),fmt(w.amplitude),'satisfies every training screen']]]){
   const body=$(target);body.replaceChildren();for(const item of values.slice(0,16)){const tr=document.createElement('tr');for(const value of format(item)){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
  }
  $('continuous-challenges').replaceChildren();for(const c of next.challenges){const p=document.createElement('p');const low=c.predictions.length?Math.min(...c.predictions.map(x=>x.interval[0])):null,high=c.predictions.length?Math.max(...c.predictions.map(x=>x.interval[1])):null;p.textContent=c.id+' at '+c.duration+' s: '+c.status+'; observed '+fmt(c.observed)+' N·m'+(low!==null?'; outer prediction span ['+fmt(low)+', '+fmt(high)+'] N·m.':'');$('continuous-challenges').append(p);}
  const joint=document.createElement('p');joint.textContent='One shared parameter pair across all qualified challenges: '+next.joint.status+'. '+next.joint.witnesses.length+' coherent witnesses; '+next.joint.unqualifiedCount+' order-confounded acquisitions. Challenge screening never changes the frozen training boxes or predictions.';$('continuous-challenges').append(joint);
  draw(f);$('continuous-export').disabled=false;
 }
 function draw(f){
  const svg=$('continuous-plot'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();
  const add=(tag,attrs,text)=>{const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;svg.append(el);};
  if(!f.boxes.length){add('text',{x:30,y:100,fill:'#a5cbd0'},'No retained parameter boxes under these bounds.');return;}
  const xmin=Math.min(...f.boxes.map(b=>b.tau[0])),xmax=Math.max(...f.boxes.map(b=>b.tau[1])),ymin=Math.min(...f.boxes.map(b=>b.amplitude[0])),ymax=Math.max(...f.boxes.map(b=>b.amplitude[1]));
  const yr=Math.max(1e-8,ymax-ymin),xr=Math.max(1e-8,xmax-xmin),X=x=>80+(x-xmin)/xr*670,Y=y=>240-(y-ymin)/yr*200;
  // Bound rendering work; each displayed rectangle remains a real retained box.
  const stride=Math.max(1,Math.ceil(f.boxes.length/1024));
  for(let i=0;i<f.boxes.length;i+=stride){const b=f.boxes[i];add('rect',{x:X(b.tau[0]),y:Y(b.amplitude[1]),width:Math.max(.5,X(b.tau[1])-X(b.tau[0])),height:Math.max(.5,Y(b.amplitude[0])-Y(b.amplitude[1])),fill:b.resolutionMet?'#759edd':'#ffad5c',opacity:.35});}
  for(const w of f.witnesses.filter((_,i)=>i%Math.max(1,Math.ceil(f.witnesses.length/256))===0))add('circle',{cx:X(w.tau),cy:Y(w.amplitude),r:3,fill:'#5df5df'});
  for(let i=0;i<=4;i++){const x=xmin+xr*i/4,y=ymin+yr*i/4;add('text',{x:X(x),y:264,fill:'#a5cbd0','text-anchor':'middle'},fmt(x));add('text',{x:72,y:Y(y)+4,fill:'#a5cbd0','text-anchor':'end'},fmt(y));}
  add('text',{x:80,y:20,fill:'#a5cbd0'},'Coupling N·m · zoomed outer boxes (blue/amber), feasible witnesses (cyan)');
  add('text',{x:400,y:290,fill:'#a5cbd0','text-anchor':'middle'},'Relaxation tau · seconds');
  $('continuous-plot-note').textContent=stride>1?'Rendering every '+stride+'th retained box for responsiveness; export and counts retain all inputs and recompute the full search.':'All retained boxes are shown. A rectangle is a conservative numerical enclosure, not a fitted model or confidence region.';
 }
 function run(){epoch++;const next=analyzeContinuousDurationStudy(controller.getStudy(),settings());render(next);}
 $('continuous-form').onsubmit=e=>{e.preventDefault();safe(run);};
 for(const input of $('continuous-form').querySelectorAll('input'))input.addEventListener('input',invalidate);
 document.addEventListener('worldlaw-duration-study-change',invalidate);
 $('continuous-example').onclick=()=>safe(()=>{controller.adopt(continuousDurationExample($('continuous-kind').value));run();});
 $('continuous-export').onclick=()=>safe(()=>{if(!report)throw Error('Recompute the comparison first.');const url=URL.createObjectURL(new Blob([exportContinuousInvestigation(controller.getStudy(),report.fit.settings)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='worldlaw-continuous-duration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('continuous-open').onclick=()=>$('continuous-file').click();
 $('continuous-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const own=++epoch;try{if(file.size>4000000)throw Error('Use JSON below 4 MB.');const text=await file.text();if(own!==epoch)return;const loaded=importContinuousInvestigation(text),next=analyzeContinuousDurationStudy(loaded.study,loaded.settings);if(own!==epoch)return;controller.adopt(loaded.study);for(const[key,id]of Object.entries({tauMin:'continuous-min',tauMax:'continuous-max',tauResolution:'continuous-resolution',maxBoxes:'continuous-budget'}))$(id).value=loaded.settings[key];render(next);$('continuous-error').textContent='';}catch(error){if(own===epoch)$('continuous-error').textContent=error.message;}finally{if(e.target.files?.[0]===file)e.target.value='';}};
 invalidate();
}
