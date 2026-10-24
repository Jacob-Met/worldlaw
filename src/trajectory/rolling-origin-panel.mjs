import {rollingOriginChallenge,exportRollingOrigin} from './rolling-origin.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(4)).toString():'unavailable';
export function createRollingOriginPanel(anchor){
 const host=node('section');host.id='rolling-origin-panel';host.className='panel';host.hidden=true;anchor.after(host);
 const style=node('style');style.textContent=`#rolling-origin-panel{display:grid;gap:14px;padding:clamp(16px,2vw,26px);border-top:3px solid #788257}#rolling-origin-panel[hidden],#rolling-origin-panel [hidden]{display:none}#rolling-origin-panel h2{margin:0;font-size:clamp(18px,2vw,24px);line-height:1.3}#rolling-origin-panel p{margin:0;font-size:12px;line-height:1.65;color:#52634f}#rolling-origin-panel .rolling-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#rolling-origin-panel label{display:grid;gap:5px;min-width:0;font-size:11px;line-height:1.5}#rolling-origin-panel input,#rolling-origin-panel select{width:100%;min-width:0;box-sizing:border-box;min-height:42px;padding:9px;border:1px solid #cdd7c5;background:#fffef9;color:#203928}#rolling-origin-panel button{min-height:42px;justify-self:start}#rolling-status{padding:10px 12px;background:#faf8ed;border-left:2px solid #788257}#rolling-origin-panel table{border-collapse:collapse;width:100%;font-size:11px;line-height:1.5}#rolling-origin-panel th,#rolling-origin-panel td{padding:8px;border-bottom:1px solid #e1e5da;text-align:left}#rolling-origin-panel summary{cursor:pointer;font-size:12px;font-weight:600}#rolling-chart{min-width:0}#rolling-chart svg{display:block;width:100%;height:auto;border:1px solid #e1e5da;background:#fffef9}#rolling-origin-panel .rolling-table{min-width:0;max-width:100%;overflow:auto}@media(max-width:540px){#rolling-origin-panel .rolling-controls{grid-template-columns:1fr}}`;
 const title=node('h2','Does the law predict motion from repeated measured starts?');
 const intro=node('p','Keep the law fixed. At each declared origin, estimate the starting rate from earlier positions and predict forward. These conditional forecasts reset state; they are not a better original-start trajectory.');
 const controls=node('div');controls.className='rolling-controls';
 const input=(label,id,value)=>{const wrap=node('label',label),e=node('input');e.id=id;e.value=value;wrap.append(e);controls.append(wrap);return e;};
 const origins=input('Origin sample indices (zero based, comma separated)','rolling-origins','');
 const horizons=input('Forward sample counts (comma separated)','rolling-horizons','10,50,100');
 const window=input('Earlier-position window (odd sample count)','rolling-window','9');window.type='number';window.min='5';window.max='31';window.step='2';
 const sigma=input('Declared position noise in rad (blank: residual proxy)','rolling-sigma','.001');sigma.type='number';sigma.min='0';sigma.step='.001';
 const execute=node('button','Compare conditional forecasts');execute.id='compare-rolling';execute.className='button outline';execute.type='button';
 const status=node('p');status.id='rolling-status';status.setAttribute('role','status');
 const summary=node('div');summary.className='rolling-table';
 const selection=node('label','Show forecast horizon');const select=node('select');select.id='rolling-show-horizon';selection.append(select);selection.hidden=true;
 const chart=node('div');chart.id='rolling-chart';
 const legend=node('p','Orange: frozen-law conditional forecasts. Dark blue: recorded angles. Each orange start uses only its preceding measurement window.');legend.hidden=true;
 const details=node('details'),detailsTitle=node('summary','Inspect every declared origin and outcome'),rows=node('div');rows.className='rolling-table';details.append(detailsTitle,rows);details.hidden=true;
 const download=node('button','Export rolling-origin inputs');download.type='button';download.className='button outline';download.id='export-rolling';download.hidden=true;
 host.append(style,title,intro,controls,execute,status,summary,selection,chart,legend,details,download);
 let model,run,solver,result,ticket=0,plotWidth=0,resizeFrame;
 function invalidate(){ticket++;result=null;summary.replaceChildren();chart.replaceChildren();rows.replaceChildren();select.replaceChildren();selection.hidden=legend.hidden=details.hidden=download.hidden=true;execute.disabled=false;status.textContent='Declarations changed; prior predictions are cleared. No law is refitted.';}
 for(const control of [origins,horizons,window,sigma])control.addEventListener('input',invalidate);
 const list=e=>e.value.trim()===''?[]:e.value.split(',').map(s=>s.trim()===''?NaN:Number(s));
 function table(headers,data){const t=node('table'),head=node('tr');for(const text of headers){const th=node('th',text);th.scope='col';head.append(th);}t.append(head);for(const row of data){const tr=node('tr');for(const text of row)tr.append(node('td',String(text)));t.append(tr);}return t;}
 function plot(){
  chart.replaceChildren();if(!result)return;const horizon=Number(select.value),population=result.trials.filter(t=>t.horizonSamples===horizon);plotWidth=Math.round(chart.clientWidth);
  if(population.some(t=>t.status!=='screened')){chart.append(node('p','Incomplete horizon: no partial-survivor forecast plot. Inspect every origin below.'));return;}
  const W=Math.max(200,plotWidth||680),H=260,L=60,R=18,T=36,B=46;
  const first=Math.min(...population.map(t=>t.originIndex)),last=Math.max(...population.map(t=>t.originIndex+t.horizonSamples)),observed=run.samples.slice(first,last+1),start=observed[0].time,span=observed.at(-1).time-start;
  const values=[...observed.map(r=>r.position),...population.flatMap(t=>t.forecast.predictions.map(p=>p.position))],lo=Math.min(...values),hi=Math.max(...values),range=Math.max(1e-8,hi-lo);
  const x=t=>L+(W-L-R)*(t-start)/span,y=v=>H-B-(H-T-B)*(v-lo)/range;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Recorded angular motion and separate short forecast segments, restarted from declared measured prefixes.');
  const path=(samples,color,width)=>{const p=document.createElementNS(svg.namespaceURI,'polyline');p.setAttribute('points',samples.map(r=>`${x(r.time)},${y(r.position)}`).join(' '));p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width',width);svg.append(p);};
  path(observed,'#153c57',2);for(const t of population)path(t.forecast.predictions,'#c76520',1.5);
  for(const [text,xx,yy,anchor]of [['Angle (rad)',12,15,'start'],['Elapsed time (s)',W-R,15,'end'],[fmt(hi),L-7,T+4,'end'],[fmt(lo),L-7,H-B+4,'end'],['0',L,H-12,'start'],[fmt(span),W-R,H-12,'end']]){const e=document.createElementNS(svg.namespaceURI,'text');e.textContent=text;for(const [k,v]of Object.entries({x:xx,y:yy,'text-anchor':anchor,'font-size':11,fill:'#52634f'}))e.setAttribute(k,v);svg.append(e);}
  chart.append(svg);
 }
 new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(result&&Math.round(chart.clientWidth)!==plotWidth)plot();});}).observe(chart);
 select.addEventListener('change',plot);
 execute.addEventListener('click',async()=>{
  invalidate();const mine=ticket;execute.disabled=true;status.textContent='Executing every declared origin and horizon…';await new Promise(requestAnimationFrame);if(mine!==ticket)return;
  try{
   result=rollingOriginChallenge(model,run,{origins:list(origins),horizonSamples:list(horizons),windowSize:Number(window.value),positionSigma:sigma.value.trim()===''?null:Number(sigma.value),maxStep:solver.maxStep});
   const complete=result.summaries.filter(s=>s.status==='complete').length;
   status.textContent=`${complete}/${result.summaries.length} complete horizons; ${result.trials.length} declared origin/horizon pairs retained. Conditional resets reuse measured evidence; overlap is not independent replication.`;
   summary.append(table(['Forward samples','Origins','Model RMSE (rad)','Constant-rate RMSE (rad)','Outcome'],result.summaries.map(s=>[s.horizonSamples,s.origins,fmt(s.modelRMSE),fmt(s.baselines.find(b=>b.id==='initial_rate').rmse),s.status])));
   for(const s of result.summaries){const option=node('option',`${s.horizonSamples} forward samples · ${s.status}`);option.value=String(s.horizonSamples);select.append(option);}
   rows.append(table(['Origin sample','Time (s)','Prefix samples','Horizon samples','Duration (s)','Rate (rad/s)','RMSE (rad)','Outcome'],result.trials.map(t=>[t.originIndex,fmt(t.originTime),`${t.prefix.startIndex}–${t.prefix.endIndex}`,t.horizonSamples,fmt(t.duration),fmt(t.rateEstimate.rate),fmt(t.receiving?.scores[0]?.rmse),t.status])));
   selection.hidden=legend.hidden=details.hidden=download.hidden=false;plot();
  }catch(error){result=null;status.textContent=error.message;}finally{execute.disabled=false;}
 });
 download.addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([exportRollingOrigin(result)],{type:'application/json'})),a=node('a');a.href=url;a.download='worldlaw-rolling-origin.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 return {render(nextModel,nextRun,nextSolver){invalidate();model=nextModel;run=nextRun;solver=nextSolver;host.hidden=model?.schema!=='worldlaw.angular-model/v1';if(host.hidden)return;const n=run.samples.length,windowSize=n>=10?9:5,maxH=Math.max(1,Math.min(100,Math.floor((n-windowSize)/2)));horizons.value=maxH>=100?'10,50,100':String(Math.max(1,maxH));const stride=Math.max(9,Math.floor((n-1)/10));origins.value=Array.from({length:9},(_,i)=>(i+1)*stride).filter(i=>i+maxH<n).join(',');if(!origins.value&&windowSize-1+maxH<n)origins.value=String(windowSize-1);window.value=String(windowSize);status.textContent=`${run.samples.length} observed positions in ${run.id}. Default index spacing uses record length only. Declare origins and horizons before inspecting errors; later tuning is exploratory.`;}};
}
