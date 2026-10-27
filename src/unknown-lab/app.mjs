import {mountReferenceChannel} from './reference-panel.mjs';
import {mountMixedStateResponse} from './mixed-state-panel.mjs';
import {mountRecoveryTransport} from './recovery-transport-panel.mjs';
import {mountRecoverySupport} from './recovery-support-panel.mjs';
import {mountSaturationProfile} from './saturation-profile-panel.mjs';
import {mountJointQualification} from './joint-qualification-panel.mjs';
import {mountDriftConstruction} from './drift-construction-panel.mjs';
import {mountCorrelationBand} from './correlation-band-panel.mjs';
import {mountPeriodicHistoryRange} from './periodic-history-range-panel.mjs';
import {mountPeriodicCourse} from './periodic-course-panel.mjs';
import {mountSmoothDrift} from './smooth-drift-panel.mjs';
import {mountPeriodBands} from './period-band-panel.mjs';
import {mountPeriodicContrast} from './periodic-contrast-panel.mjs';
import {mountOrderConstruction} from './order-construction-panel.mjs';
import {mountSerialOrders} from './serial-order-panel.mjs';
import {mountSerialNoise} from './serial-noise-panel.mjs';
import {mountProbePlanner} from './probe-planner-panel.mjs';
import {mountProbePanel} from './probe-panel.mjs';
import {mountRecoveryPlanner} from './recovery-planner-panel.mjs';
import {mountRecoveryPanel} from './recovery-panel.mjs';
import {mountContinuousDuration} from './continuous-duration-panel.mjs';
import {mountDurationPlanner} from './duration-planner-panel.mjs';
import {mountDurationPanel} from './duration-panel.mjs';
import {syntheticChallenge,evaluateHistory,importNotebook,exportNotebook} from './paired-history.mjs';
const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg', storageKey='worldlaw.unknown-lab.history.v1';
let notebook=null;
let periodicContrastPanel=null;
let periodicCoursePanel=null;
let periodicHistoryRangePanel=null;
let mixedStatePanel=null;
const fmt=(v,d=3)=>Number.isFinite(v)?Number(v.toPrecision(d)).toLocaleString('en-US',{maximumFractionDigits:6}):'—';
function clearError(){$('error').hidden=true;}
function error(e){$('error').hidden=false;$('error').textContent=e.message||String(e);$('error').focus();}
function safe(fn){Promise.resolve().then(fn).catch(error);}
function svgNode(tag,attrs={},text=null) {
  const el=document.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));
  if(text!==null)el.textContent=String(text);
  return el;
}
function renderPlot(pairs){
  const W=1000,H=440,L=92,R=48,T=28,B=58;
  const all=pairs.flatMap(p=>[p.reference.jointTorque,p.conditioned.jointTorque]);
  let xmin=Math.min(...all),xmax=Math.max(...all);
  const spread=Math.max(.15,(xmax-xmin)*.1);xmin-=spread;xmax+=spread;
  const X=v=>L+(v-xmin)/(xmax-xmin)*(W-L-R);
  const Y=i=>T+(i+.5)/pairs.length*(H-T-B);
  const svg=svgNode('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':pairs.length+' matched torque pairs, reference in cyan, conditioned in amber'});
  const title=svgNode('title',{},'Observed torque by paired preconditioning history');svg.append(title);
  for(let i=0;i<=5;i++){
    const v=xmin+(xmax-xmin)*i/5,x=X(v);
    svg.append(svgNode('line',{x1:x,y1:T,x2:x,y2:H-B,stroke:'#315460','stroke-dasharray':'2 7'}));
    svg.append(svgNode('text',{x,y:H-25,fill:'#a5cbd0','text-anchor':'middle','font-size':15},fmt(v,3)));
  }
  for(let i=0;i<pairs.length;i++){
    const pair=pairs[i],y=Y(i),x0=X(pair.reference.jointTorque),x1=X(pair.conditioned.jointTorque);
    svg.append(svgNode('line',{x1:Math.min(x0,x1),y1:y,x2:Math.max(x0,x1),y2:y,stroke:'#819da8','stroke-width':Math.max(2,11-pairs.length/14),opacity:.85}));
    svg.append(svgNode('circle',{cx:x0,cy:y,r:Math.max(3,8-pairs.length/34),fill:'#5df5df'}));
    svg.append(svgNode('circle',{cx:x1,cy:y,r:Math.max(3,8-pairs.length/34),fill:'#ffad5c'}));
    if(i%Math.max(1,Math.ceil(pairs.length/12))===0)svg.append(svgNode('text',{x:L-14,y:y+5,fill:'#8db5bd','text-anchor':'end','font-size':13},String(i+1).padStart(2,'0')));
  }
  svg.append(svgNode('text',{x:(W+L-R)/2,y:H-3,'text-anchor':'middle',fill:'#cceded','font-size':14},'JOINT TORQUE · N·m'));
  $('plot').replaceChildren(svg);
}
function render(){
 mixedStatePanel?.invalidate();
 periodicContrastPanel?.invalidate();
 const report=evaluateHistory(notebook);
 $('source-badge').textContent=report.source==='measured'?'USER-DECLARED MEASUREMENTS':'DECLARED SIMULATION';
 $('offset').textContent=fmt(report.decisionDifference)+' N·m';
 const order=report.order;
 $('order-status').textContent=order.status==='counterbalanced'
   ?notebook.simulation?.orderStrategy==='alternating'?'FIXED AB/BA · PHASE RISK':'ORDER COUNTERBALANCED'
   :order.status==='unbalanced'?'ORDER CONFOUNDED':'ORDER NOT RECORDED';
 $('order-split').textContent=order.status==='unrecorded'?'Legacy observations: no sample chronology':
   'Reference first '+order.referenceFirst+' / conditioned first '+order.conditionedFirst+(notebook.simulation?' · '+notebook.simulation.orderStrategy+' virtual sequence':'');
 $('order-adjustment').textContent=order.status==='counterbalanced'
   ?'Raw '+fmt(report.meanDifference)+' N·m → adjusted '+fmt(order.historyEstimate)+' N·m · estimated linear drift '+fmt(order.driftPerStep)+' N·m / reading'
     +(notebook.simulation?.orderStrategy==='alternating' && notebook.simulation?.cycleDriftAmplitude!==0?' · periodic alias warning':'')
   :'Raw paired offset '+fmt(report.meanDifference)+' N·m · no qualified drift separation';
 $('bound').textContent='±'+fmt(report.boundary)+' N·m';
 $('detected').textContent=report.pairsAboveInstrumentNoise+'/'+report.count;
 $('status').textContent=report.verdict==='challenged'?'CHALLENGED':'INCONCLUSIVE';
 $('interpretation').textContent=report.interpretation;
 $('source-note').textContent=report.source==='measured'?'Imported: user-declared measurements; unverified custody':'Virtual oracle, not physical receiving';
 const body=$('rows');body.replaceChildren();
 for(const p of report.pairs.slice(0,16)){
   const tr=document.createElement('tr');
   for(const s of [p.id,fmt(p.reference.jointTorque,6),fmt(p.conditioned.jointTorque,6),fmt(p.difference,6)]){
     const td=document.createElement('td');td.textContent=s;tr.append(td);
   }
   body.append(tr);
 }
 renderPlot(report.pairs);
 clearError();
}
function adopt(next,note){
 notebook=importNotebook(exportNotebook(next));render();$('storage').textContent=note+' · Nothing is saved automatically.';
}
function virtualRun(){
 const count=Number($('count').value),sigma=Number($('sigma').value);
 if(!$('count').value.trim()||!Number.isInteger(count))throw new Error('Enter an integer count.');
 if(!$('sigma').value.trim()||!Number.isFinite(sigma))throw new Error('Enter a finite noise assumption.');
 const effect=Number($('effect').value),duration=Number($('duration').value);
 const driftPerReading=Number($('drift').value);
 if(!$('drift').value.trim()||!Number.isFinite(driftPerReading))throw new Error('Enter a finite simulated drift per reading.');
 const orderStrategy=$('order').value;
 const cycleDriftAmplitude=Number($('cycle').value),seed=Number($('seed').value);
 if(!$('cycle').value.trim()||!Number.isFinite(cycleDriftAmplitude))throw new Error('Enter a finite periodic virtual sensor offset.');
 if(!$('seed').value.trim()||!Number.isSafeInteger(seed))throw new Error('Enter an integer virtual randomization seed.');
 adopt(syntheticChallenge({count,noiseSigma:sigma,effect,duration,seed,driftPerReading,cycleDriftAmplitude,orderStrategy}),'Executed independent paired virtual readings');
}
function download(text,name){
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);
 anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
$('run-form').addEventListener('submit',e=>{e.preventDefault();safe(virtualRun);});
for(const id of ['effect','duration'])$(''+id).addEventListener('input',()=>{
 $(''+id+'-out').textContent=Number($(id).value).toFixed(id==='effect'?2:1);
});
$('export').addEventListener('click',()=>safe(()=>download(exportNotebook(notebook),'worldlaw-history-pairs.json')));
$('import').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
   if(file.size>200000)throw new Error('Use a JSON evidence file under 200 KB.');
   adopt(importNotebook(await file.text()),'Imported a user-declared notebook');
 }catch(err){error(err);}finally{e.target.value='';}
});
$('remember').addEventListener('click',()=>safe(()=>{
 localStorage.setItem(storageKey,exportNotebook(notebook));$('storage').textContent='Explicitly saved to this browser · Export for a portable copy.';
}));
$('forget').addEventListener('click',()=>safe(()=>{
 localStorage.removeItem(storageKey);$('storage').textContent='Local saved copy forgotten; the current experiment remains in memory.';
}));
try {
 const saved=localStorage.getItem(storageKey);
 if(saved) adopt(importNotebook(saved),'Reopened explicitly saved local copy');
 else adopt(syntheticChallenge(),'Executed virtual baseline');
}catch(e){adopt(syntheticChallenge(),'Executed virtual baseline (browser storage unavailable)');}


const durationPanel=mountDurationPanel(()=>notebook);
mixedStatePanel=mountMixedStateResponse(()=>notebook);
mountDurationPlanner(durationPanel);

mountContinuousDuration(durationPanel);

const recoveryPanel=mountRecoveryPanel(()=>notebook);
mountRecoveryPlanner(recoveryPanel);
mountRecoverySupport(recoveryPanel);
mountRecoveryTransport(recoveryPanel);

const probePanel=mountProbePanel();
mountProbePlanner(probePanel);
mountSaturationProfile(probePanel);

mountSerialNoise(()=>notebook);
periodicContrastPanel=mountPeriodicContrast(()=>notebook,{onInvalidate:()=>periodicCoursePanel?.invalidate()});
periodicCoursePanel=mountPeriodicCourse(()=>periodicContrastPanel.getInputs(),{onInvalidate:()=>periodicHistoryRangePanel?.invalidate()});
periodicHistoryRangePanel=mountPeriodicHistoryRange(()=>periodicCoursePanel.getInputs());


mountSerialOrders();

mountOrderConstruction();

mountPeriodBands();

mountSmoothDrift();

mountCorrelationBand();

mountDriftConstruction();



mountJointQualification();


mountReferenceChannel();
