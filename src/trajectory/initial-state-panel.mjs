import {createInitialEnergyControls} from './initial-energy-panel.mjs';
/** A supplemental instrument in the existing angular challenge, never a refitter. */
import {createPreludeControls} from './prelude-panel.mjs';
import {comparePrelude,exportPreludeComparison} from './prelude-investigation.mjs';
import {initialStateSensitivity} from './initial-state-sensitivity.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=n=>Number(n.toPrecision(4)).toString();
export function createInitialStatePanel(anchor){
 const host=node('section');host.className='panel initial-state-instrument';host.id='initial-state-panel';host.hidden=true;anchor.after(host);
 const style=node('style');style.textContent=`
  #initial-state-panel{padding:clamp(16px,2vw,26px);display:grid;gap:14px;border-top:3px solid #c76520}
  #initial-state-panel[hidden]{display:none}
  #initial-state-panel h2{margin:0;max-width:34ch;font-size:clamp(18px,2vw,24px);line-height:1.3;color:var(--ink,#203928)}
  #initial-state-panel p{margin:0;font-size:12px;line-height:1.65;color:#52634f}
  #initial-state-panel .initial-state-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:12px;align-items:end}
  #initial-state-panel label{min-width:0;font-size:11px;font-weight:600;line-height:1.4;color:#394d35}
  #initial-state-panel input{box-sizing:border-box;width:100%;min-width:0;min-height:42px;margin:0;padding:9px 10px;border:1px solid #cdd7c5;border-radius:5px;background:#fffef9;color:#203928;font:12px var(--mono,monospace)}
  #initial-state-panel button{min-height:42px;font-size:12px;line-height:1.35;padding:10px 14px}
  #initial-state-status{padding:9px 12px;border-left:2px solid #c76520;background:#faf8ed}
  #initial-state-panel .initial-state-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;line-height:1.5}
  #initial-state-panel .initial-state-legend[hidden]{display:none}
  #initial-state-panel .initial-state-legend span{display:inline-flex;gap:7px;align-items:center}
  #initial-state-panel .initial-state-legend i{display:inline-block;width:20px;border-top:2px solid currentColor}
  #initial-state-chart{min-width:0;border:1px solid #e2e6db;border-radius:5px;background:#fffef9}
  #initial-state-chart:empty{display:none}
  #initial-state-chart svg{display:block;width:100%;height:auto}
  #initial-state-panel>button{justify-self:start}
  @media(max-width:700px){#initial-state-panel .initial-state-controls{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}#compare-initial-states{grid-column:1/-1;justify-self:start}}
  @media(max-width:380px){#initial-state-panel .initial-state-controls{grid-template-columns:minmax(0,1fr)}}
 `;
 const title=node('h2','Could the starting measurement change the prediction?');
 const intro=node('p','Hold the law fixed. Compare nine declared starting states with the separate recording. These sampled paths are not a confidence band.');
 const form=node('div');form.className='initial-state-controls';
 function input(label,id,value){const wrap=node('label',label),e=node('input');e.id=id;e.type='number';e.min='0';e.max='100';e.step='.001';e.value=value;wrap.style.cssText='display:grid;gap:.3rem;max-width:100%';wrap.append(e);form.append(wrap);return e;}
 const position=input('Initial angle half-width (rad)','initial-position-width','0.01');
 const rate=input('Initial rate half-width (rad/s)','initial-rate-width','0.05');
 const runButton=node('button','Compare declared starts');runButton.type='button';runButton.className='button outline';runButton.id='compare-initial-states';form.append(runButton);
 const status=node('p','Choose widths from measurement knowledge before comparing.');status.id='initial-state-status';status.setAttribute('role','status');
 const legend=node('div');legend.className='initial-state-legend';legend.hidden=true;
 for(const [text,color]of [['Declared-start forecasts','#c76520'],['Recorded angle','#153c57']]){const key=node('span');key.style.color=color;key.append(node('i'),node('span',text));legend.append(key);}
 const chart=node('div');chart.id='initial-state-chart';
 const detail=node('p');const download=node('button','Export sensitivity inputs and results');download.className='button outline';download.hidden=true;
 host.append(style,title,intro,form,status,legend,chart,detail,download);
 let model,run,options,result,ticket=0,plotWidth=0,resizeFrame,preludeSelection=null,preludeResult=null;
 const energy=createInitialEnergyControls(chart,()=>({model,run,positionWidth:position.value,rateWidth:rate.value,prelude:!!preludeSelection,setWidths(widths){position.value=String(widths.positionHalfWidth);rate.value=String(widths.rateHalfWidth);invalidate();}}));
 const prelude=createPreludeControls(form,()=>run,value=>{preludeSelection=value;invalidate();});
 function invalidate(){energy.clear();ticket++;result=null;preludeResult=null;chart.replaceChildren();legend.hidden=true;detail.textContent='';download.hidden=true;runButton.disabled=false;status.textContent='Inputs changed. Recompute the declared grid; prior paths are cleared.';}
 position.addEventListener('input',invalidate);rate.addEventListener('input',invalidate);
 function plot(report){
  const f=report.forecasts; if(!f.complete)return;
  const actualWidth=Math.round(chart.clientWidth);plotWidth=actualWidth;const W=Math.max(200,actualWidth||680),H=260,left=60,right=18,top=36,bottom=46,t0=run.samples[0].time,dt=run.samples.at(-1).time-t0;
  const values=[...run.samples.map(p=>p.position),...f.range.flatMap(p=>[p.min,p.max])],lo=Math.min(...values),span=Math.max(1e-8,Math.max(...values)-lo);
  const x=t=>left+(W-left-right)*(t-t0)/dt,y=v=>H-bottom-(H-top-bottom)*(v-lo)/span;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.style.width='100%';svg.setAttribute('role','img');svg.setAttribute('aria-label','Separate observed angle in dark blue and declared initial-state forecast paths in orange. Time increases left to right.');
  function path(rows,color,width){const e=document.createElementNS(svg.namespaceURI,'polyline');e.setAttribute('points',rows.map(r=>`${x(r.time)},${y(r.position)}`).join(' '));e.setAttribute('fill','none');e.setAttribute('stroke',color);e.setAttribute('stroke-width',width);svg.append(e);}
  for(const v of f.variants)path(v.predictions,'#c76520',1);
  path(run.samples,'#153c57',2.5);
  for(const [text,xx,yy,anchor]of [['Angle (rad)',12,15,'start'],['Elapsed time (s)',W-right,15,'end'],[fmt(lo+span),left-7,top+4,'end'],[fmt(lo),left-7,H-bottom+4,'end'],['0',left,H-12,'start'],[fmt(dt),W-right,H-12,'end']]){const e=document.createElementNS(svg.namespaceURI,'text');e.textContent=text;e.setAttribute('x',xx);e.setAttribute('y',yy);e.setAttribute('text-anchor',anchor);e.setAttribute('font-size','11');e.setAttribute('fill','#52634f');svg.append(e);}
  chart.replaceChildren(svg);legend.hidden=false;
 }
 new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{const width=Math.round(chart.clientWidth);if(result?.forecasts.complete&&width>0&&width!==plotWidth)plot(result);});}).observe(chart);
 runButton.addEventListener('click',async()=>{
  invalidate();const mine=ticket;runButton.disabled=true;status.textContent='Executing the complete declared grid…';
  await new Promise(requestAnimationFrame);if(mine!==ticket)return;
  try{
   if(!position.value.trim()||!rate.value.trim())throw Error('Enter both declared half-widths.');
   const gridOptions={positionHalfWidth:Number(position.value),rateHalfWidth:Number(rate.value),maxStep:options.maxStep};
   if(preludeSelection){preludeResult=comparePrelude(model,run,preludeSelection.input,{...preludeSelection.options,...gridOptions});result=preludeResult.derived;}
   else result=initialStateSensitivity(model,run,gridOptions);
   const f=result.forecasts,counts=f.variants.reduce((a,v)=>(a[v.status]=(a[v.status]||0)+1,a),{});
   status.textContent=f.complete?`${f.variants.length} starting states screened. ${result.receiving.outsideCount}/${result.receiving.count} later observed angles fall outside the sampled path range.`:`Grid incomplete: ${counts.failed||0} failed and ${counts.step_sensitive||0} step-sensitive variants. No range or partial-survivor plot is shown.`;
   detail.textContent=f.meaning+' Widths are declarations; the law and its training rank are unchanged. '+f.variants.filter(v=>v.error).map(v=>v.error.message).join(' ');
   if(preludeResult)detail.textContent+=` Prelude rate ${fmt(preludeResult.derivedRate)} rad/s; original supplied rate ${fmt(preludeResult.originalRate)} rad/s. The original nominal prediction RMSE is ${Number.isFinite(preludeResult.original.receiving.scores[0].rmse)?fmt(preludeResult.original.receiving.scores[0].rmse):'unavailable'} rad. Conditional prelude sigma is not a grid width.`;
   plot(result);download.hidden=false;
  }catch(error){status.textContent=error.message;result=null;}finally{runButton.disabled=false;}
 });
 download.addEventListener('click',()=>{if(!result)return;const blob=new Blob([preludeResult?exportPreludeComparison(preludeResult):JSON.stringify({schema:'worldlaw.initial-state-receipt/v1',model,run,options:result.forecasts.options,result},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=preludeResult?'worldlaw-prelude-comparison.json':'worldlaw-initial-state-sensitivity.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 return {setBusy(value){energy.setBusy(value);},render(nextModel,nextRun,nextOptions){invalidate();model=nextModel;run=nextRun;options=nextOptions;prelude.reset();host.hidden=model?.schema!=='worldlaw.angular-model/v1';status.textContent='Choose widths from measurement knowledge before comparing. Reusing this recording to choose widths is exploratory.';}};
}
