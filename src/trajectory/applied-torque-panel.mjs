import {identifyAppliedTorque,reopenAppliedTorque,exportAppliedTorque} from './applied-torque.mjs';
import {appliedTorqueExample} from './applied-torque-example.mjs';
export function createAppliedTorquePanel(anchor){
 const panel=document.createElement('section');panel.className='panel';panel.id='applied-torque-panel';
 panel.innerHTML=`<div class="section-heading"><span class="section-number" aria-hidden="true">I</span><h2>Identify inertia from applied torque</h2></div><p>Inspect one declared balance: applied joint torque = inertia × acceleration + linear damping × rate + stiffness × angle. Calibrated torque is distinct from an actuator command. No physical inertia is supplied.</p><div class="applied-actions"><button type="button" data-action="example">Load authored excitation</button> <button type="button" data-action="single">Load confounded single frequency</button></div><label class="applied-source">Original applied-torque JSON <input type="file" accept=".json,application/json" data-input="file"></label><details class="evidence-details"><summary>Inspect or edit original inputs</summary><label>Source JSON<textarea data-input="source" rows="10" style="width:100%;box-sizing:border-box" spellcheck="false"></textarea></label></details><div class="applied-controls"><label>Window seconds <input data-input="duration" type="number" value="0.8" min="0.02" max="60" step="0.1"></label> <label>Stride seconds <input data-input="stride" type="number" value="0.4" min="0.01" step="0.1"></label> <label>Forward step seconds <input data-input="step" type="number" value="0.005" min="0.00001" max="0.1" step="0.001"></label></div><div class="applied-actions"><button type="button" data-action="fit">Identify &amp; challenge</button> <button type="button" data-action="save" disabled>Save original inputs</button></div><p class="notice" data-output="status" role="status">Load separately labelled training and challenge recordings.</p><div data-output="result"></div>`;
 const style=document.createElement('style');style.textContent=`
 #applied-torque-panel{padding:clamp(16px,2vw,28px);border-top:3px solid #136f89;margin-top:24px}
 #applied-torque-panel .section-heading{margin-bottom:14px}#applied-torque-panel .section-heading h2{font-size:clamp(20px,2.3vw,29px)}
 #applied-torque-panel p{line-height:1.65;margin:10px 0;overflow-wrap:anywhere}
 #applied-torque-panel h3{font-size:16px;margin:24px 0 10px;padding-top:18px;border-top:1px solid var(--line)}
 #applied-torque-panel .applied-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0 4px}
 #applied-torque-panel label{display:grid;gap:7px;font-size:12px;min-width:0}
 #applied-torque-panel input{max-width:100%;min-width:0}#applied-torque-panel input[type=number]{margin:0}
 #applied-torque-panel .applied-source{margin:18px 0}#applied-torque-panel input[type=file]{padding:10px;background:#f7f8f1;border:1px solid var(--line);border-radius:6px}
 #applied-torque-panel .applied-actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
 #applied-torque-panel .button{white-space:normal;max-width:100%;min-height:42px}
 #applied-torque-panel textarea{padding:12px;margin-top:10px;font:11px/1.6 var(--mono);border:1px solid var(--line);border-radius:6px;background:#fffefa;color:var(--ink)}
 #applied-torque-panel textarea:focus-visible{outline:3px solid #95ad5d;outline-offset:3px}
 #applied-torque-panel [data-output=status]{padding:12px 15px;margin:18px 0;border-left:3px solid #136f89;background:#edf5f8}
 #applied-torque-panel svg{display:block;width:100%;height:auto;background:#fbfdff;border:1px solid #b9cfd5;border-radius:6px;margin-top:14px}
 #applied-torque-panel .applied-parameters{font:13px/1.8 var(--mono);padding:14px 16px;background:#f0f4e7;border-left:3px solid #819d55}
 #applied-torque-panel .applied-legend{display:flex;flex-wrap:wrap;gap:12px 22px;font-size:12px}
 #applied-torque-panel .applied-legend span{border-bottom:3px solid;padding-bottom:3px}
 #applied-torque-panel pre{white-space:pre-wrap;overflow-wrap:anywhere}
 @media(max-width:700px){#applied-torque-panel .applied-controls{grid-template-columns:1fr;gap:12px}#applied-torque-panel .applied-actions .button{flex:1 1 180px}}
 `;panel.prepend(style);
 for(const button of panel.querySelectorAll('button'))button.className='button '+(button.dataset.action==='fit'?'accent':'outline');
 anchor.after(panel);const find=s=>panel.querySelector(s),source=find('[data-input=source]'),status=find('[data-output=status]'),result=find('[data-output=result]'),save=find('[data-action=save]');let current=null,generation=0;
 const invalidate=()=>{generation++;find('[data-action=fit]').disabled=false;current=null;save.disabled=true;result.replaceChildren();status.textContent='Inputs changed. Recompute before interpreting a result.';};
 for(const input of panel.querySelectorAll('textarea,input[type=number]'))input.addEventListener('input',invalidate);
 const add=(tag,text,parent=result)=>{const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;};
 function render(value){
  current=value;result.replaceChildren();save.disabled=false;status.textContent=value.status.replaceAll('_',' ');
  add('p',`Input rank ${value.rank} of 3; ${value.windowCount} complete weak windows. Calibration basis: ${value.source.calibrationBasis}`);
  if(!value.candidate){add('p',value.status==='unidentifiable'?'The supplied motion does not distinguish all three coefficients. No inertia or forecast is supplied.':'The fitted coefficients violate positive inertia or nonnegative damping. No executable physical candidate is supplied.');if(value.rejectedCoefficients)add('pre',JSON.stringify(value.rejectedCoefficients,null,2));return;}
  const c=value.candidate;add('p',`Conditional inertia ${c.inertia.toPrecision(7)} kg·m² · damping ${c.damping.toPrecision(7)} N·m·s/rad · stiffness ${c.stiffness.toPrecision(7)} N·m/rad`).className='applied-parameters';
  add('p',`Weak residual ${c.weakRmse.toExponential(3)} N·m·s² after operator-gain normalization; numerical conditioning estimate ${c.conditionEstimate.toPrecision(4)}. This is not forward error or calibrated confidence.`);
  for(const check of value.challenges){
   add('h3',`Separate challenge: ${check.runId}`);
   if(check.status!=='ok'){add('p',`Forecast failed: ${check.error.message}`);continue;}
   add('p',`Position RMSE ${check.rollout.metrics.positionRMSE.toPrecision(6)} rad. Numerical refinement: ${check.resolution.status}. The challenge did not fit any coefficient.`);
   const run=value.source.challengeRuns.find(r=>r.id===check.runId),rows=check.rollout.rows;
   const predicted=rows.map(r=>r.predicted);
   const observations=run.samples.map(r=>r.position),values=[...observations,...predicted].filter(Number.isFinite);
   if(predicted.every(Number.isFinite)){
    const W=Math.max(220,Math.round(result.clientWidth)),H=270,left=68,right=18,top=34,bottom=42;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Original observed angles and independent predicted angles, with elapsed time in seconds and angle in radians');
    const low=Math.min(...values),range=Math.max(...values)-low||1,start=run.samples[0].time,span=run.samples.at(-1).time-start;
    const x=t=>left+(W-left-right)*(t-start)/span,y=v=>H-bottom-(H-top-bottom)*(v-low)/range;
    const svgAdd=(tag,attrs,text)=>{const node=document.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;svg.append(node);return node;};
    const fmt=v=>Number(v.toPrecision(4)).toString();
    for(const fraction of [0,.5,1]){
     const yy=y(low+fraction*range),xx=x(start+fraction*span);
     svgAdd('line',{x1:left,x2:W-right,y1:yy,y2:yy,stroke:'#d9e3e4','stroke-width':1});
     svgAdd('text',{x:left-8,y:yy+4,'text-anchor':'end','font-size':11,fill:'#52634f'},fmt(low+fraction*range));
     svgAdd('line',{x1:xx,x2:xx,y1:H-bottom,y2:H-bottom+5,stroke:'#7f9699'});
     svgAdd('text',{x:xx,y:H-bottom+21,'text-anchor':'middle','font-size':11,fill:'#52634f'},fmt(fraction*span));
    }
    svgAdd('text',{x:12,y:18,'font-size':11,fill:'#52634f'},'Angle (rad)');
    svgAdd('text',{x:W-right,y:18,'text-anchor':'end','font-size':11,fill:'#52634f'},'Elapsed time (s)');
    for(const [series,color] of [[observations,'#174858'],[predicted,'#a24915']])svgAdd('polyline',{points:series.map((v,i)=>`${x(run.samples[i].time)},${y(v)}`).join(' '),fill:'none',stroke:color,'stroke-width':2});
    result.append(svg);const legend=add('p','');legend.className='applied-legend';for(const [label,color]of [['Supplied observations','#174858'],['Free-running prediction','#a24915']]){const key=add('span',label,legend);key.style.color=color;key.style.borderColor=color;}

   }
  }
  const limits=add('details','');limits.className='evidence-details';add('summary','Interpretation and remaining uncertainty',limits);for(const limitation of value.limitations)add('p',limitation,limits);
 }
 function compute(){generation++;try{if(new TextEncoder().encode(source.value).length>3_000_000)throw Error('Use a JSON input file below3MB.');const parsed=JSON.parse(source.value),raw=parsed.schema==='worldlaw.applied-torque-notebook/v1'?parsed.source:parsed;render(identifyAppliedTorque(raw,{windowDuration:Number(find('[data-input=duration]').value),windowStride:Number(find('[data-input=stride]').value),maxStep:Number(find('[data-input=step]').value)}));}catch(error){current=null;save.disabled=true;result.replaceChildren();status.textContent=error.message;}}
 find('[data-action=fit]').addEventListener('click',compute);
 for(const [action,singleMode] of [['example',false],['single',true]])find(`[data-action=${action}]`).addEventListener('click',()=>{invalidate();source.value=JSON.stringify(appliedTorqueExample({singleMode}),null,2);compute();});
 find('[data-input=file]').addEventListener('change',async event=>{invalidate();const ticket=generation,file=event.target.files[0];if(!file)return;source.value='';find('[data-action=fit]').disabled=true;status.textContent='Reading replacement input; previous source retired.';try{if(file.size>3_000_000)throw Error('Use a JSON input file below3MB.');const text=await file.text();if(ticket!==generation)return;const value=reopenAppliedTorque(text);source.value=JSON.stringify(value.source,null,2);find('[data-input=duration]').value=value.options.windowDuration;find('[data-input=stride]').value=value.options.windowStride;find('[data-input=step]').value=value.options.maxStep;render(value);}catch(error){if(ticket===generation)status.textContent=error.message;}finally{if(ticket===generation)find('[data-action=fit]').disabled=false;}});
 save.addEventListener('click',()=>{if(!current)return;try{const url=URL.createObjectURL(new Blob([exportAppliedTorque(current)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='worldlaw-applied-torque.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){status.textContent=error.message;}});
 let lastWidth=0,resizeFrame;new ResizeObserver(()=>{const width=Math.round(result.clientWidth);if(width!==lastWidth){lastWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(current)render(current);});}}).observe(result);
 return panel;
}
