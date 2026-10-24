import {evaluateRecovery,predictRecovery,exportRecovery,importRecovery,RECOVERY_SCHEMA} from './recovery-response.mjs';
import {recoveryFixture} from './recovery-fixture.mjs';
const fmt=x=>Number.isFinite(x)?x.toPrecision(3):'—';
const colors=['#bac6ce','#ffad5c','#e38be9','#8eacff','#5df5df','#e2df83','#ed7898','#a5cbd0'];
export function mountRecoveryPanel(currentEvidence){
 const host=document.createElement('section');host.id='recovery-lab';host.className='readout';
 host.innerHTML=`<style>
 #recovery-lab{display:block;border-top:2px solid #5df5df;margin-top:2rem;padding-top:2rem}#recovery-lab h2{margin-bottom:.6rem}#recovery-lab .recovery-controls{display:flex;gap:.8rem;align-items:end;flex-wrap:wrap;margin:1rem 0}#recovery-lab label{display:grid;gap:.4rem;max-width:100%}#recovery-lab input,#recovery-lab select,#recovery-lab textarea{font:inherit;color:inherit;background:#102831;border:1px solid #50717c;padding:.6rem;max-width:100%;box-sizing:border-box}#recovery-lab textarea{width:100%;min-height:4rem}#recovery-lab button{border:1px solid #5df5df;background:#153c42;color:#e7fffa;padding:.7rem;cursor:pointer}#recovery-lab :focus-visible{outline:3px solid #ffad5c;outline-offset:3px}#recovery-lab svg{width:100%;height:auto;max-height:420px}#recovery-lab .recovery-error{color:#ffad5c}#recovery-lab .recovery-scroll{overflow:auto}#recovery-lab table{width:100%;min-width:550px}#recovery-lab p{max-width:90ch}#recovery-lab .recovery-source{color:#5df5df;font-weight:bold}
 </style><p class="overline">04 / AFTER PREPARATION, WAIT</p><h2>Does the response recover?</h2>
 <p>Keep the preparation fixed. Change only the waiting delay before matched readout. Compare a persistent offset with relaxing executable responses, then confront frozen forecasts with separate recordings.</p>
 <div class="recovery-controls"><label>Authored experiment<select id="recovery-demo"><option value="decay">Relaxing response</option><option value="persistent">Persistent offset control</option><option value="mismatch">Changed response challenge</option></select></label><button id="recovery-load" type="button">Execute virtual course</button><button id="recovery-reset" type="button">Start from current paired evidence</button></div>
 <p class="recovery-source" id="recovery-source"></p>
 <label>Fixed preparation / matched readout protocol<textarea id="recovery-protocol" maxlength="500"></textarea></label>
 <div class="recovery-controls"><label>Recording identity<input id="recovery-recording" value="recording-1" maxlength="80"></label><label>Wait after preparation (s)<input id="recovery-delay" type="number" min="0" max="60" step=".1" value="0"></label><label>Evidence role<select id="recovery-role"><option value="training">Training</option><option value="challenge">Separate challenge</option></select></label><button id="recovery-add" type="button">Add current paired readings</button></div>
 <p>For imports, declare the same physical preparation and matched readout conditions for every run. Identity labels cannot authenticate acquisition. The default candidate times are 0.5, 1, 2, 4 and 8 s, amplitude bounded to ±1 N·m; an imported recovery notebook may declare another bounded grid.</p>
 <p id="recovery-state" role="status" aria-live="polite"></p><div id="recovery-error" class="recovery-error" role="alert" hidden></div>
 <div id="recovery-plot"></div><div class="recovery-scroll" tabindex="0" aria-label="Recovery model results"><table><thead><tr><th>Executable response</th><th>Amplitude N·m</th><th>Training screen</th><th>Separate challenge</th></tr></thead><tbody id="recovery-models"></tbody></table></div>
 <p id="recovery-qualification"></p><div class="recovery-controls"><button id="recovery-export" type="button">Export recovery evidence</button><button id="recovery-import" type="button">Import recovery evidence</button><input id="recovery-file" type="file" accept=".json,application/json" hidden></div>`;
 document.querySelector('.scientific-limit').before(host);
 const $=id=>host.querySelector('#'+id);let notebook=recoveryFixture();
 const handle=fn=>{try{fn();$('recovery-error').hidden=true;}catch(e){$('recovery-error').hidden=false;$('recovery-error').textContent=e.message;}};
 function plot(result){
  const points=[...result.fit.training,...result.tests[0].rows];
  const maxDelay=Math.max(6,...points.map(p=>p.delaySeconds));
  const delays=Array.from({length:61},(_,i)=>i*maxDelay/60),predictions=predictRecovery(result.fit,delays);
  const bound=Math.max(.1,...points.map(p=>Math.abs(p.estimate)+p.boundary),...predictions.flatMap(p=>p.points.map(x=>Math.abs(x.prediction))));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 400');svg.setAttribute('role','img');svg.setAttribute('aria-label','Recovery response forecasts from training, with separate challenge observations; horizontal axis waiting seconds, vertical axis torque contrast.');
  function el(tag,attrs,text){const x=document.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))x.setAttribute(k,v);if(text)x.textContent=text;svg.append(x);return x;}
  const X=d=>80+d/maxDelay*870,Y=v=>180-v/bound*145;
  el('line',{x1:80,x2:950,y1:180,y2:180,stroke:'#67848c'});
  for(let t=0;t<=6;t++)el('text',{x:X(t*maxDelay/6),y:365,fill:'#cce7e8','text-anchor':'middle'},fmt(t*maxDelay/6));
  el('text',{x:500,y:395,fill:'#cce7e8','text-anchor':'middle'},'WAIT AFTER FIXED PREPARATION · SECONDS');
  for(const v of [-bound,0,bound])el('text',{x:72,y:Y(v)+5,fill:'#cce7e8','text-anchor':'end'},fmt(v));
  predictions.forEach((p,i)=>{el('path',{d:p.points.map((x,j)=>(j?'L':'M')+X(x.delaySeconds)+' '+Y(x.prediction)).join(' '),fill:'none',stroke:colors[i%colors.length],'stroke-width':p.status==='compatible'?3:1,'stroke-dasharray':p.status==='compatible'?'':'4 6',opacity:p.status==='compatible'?1:.35});});
  points.forEach((p,i)=>{const training=i<result.fit.training.length;el('line',{x1:X(p.delaySeconds),x2:X(p.delaySeconds),y1:Y(p.estimate-p.boundary),y2:Y(p.estimate+p.boundary),stroke:'#fff','stroke-width':2});el(training?'circle':'rect',training?{cx:X(p.delaySeconds),cy:Y(p.estimate),r:6,fill:'#fff'}:{x:X(p.delaySeconds)-6,y:Y(p.estimate)-6,width:12,height:12,fill:'#ffad5c'});});
  $('recovery-plot').replaceChildren(svg);
 }
 function render(){
  $('recovery-protocol').value=notebook.protocolNote;
  $('recovery-source').textContent=notebook.source==='synthetic'?'DECLARED VIRTUAL COURSE · NOT PHYSICAL OBSERVATIONS':'USER-DECLARED MEASUREMENTS · CUSTODY UNVERIFIED';
  $('recovery-state').textContent=notebook.training.length+' training recordings / '+notebook.challenges.length+' separate challenges';
  if(notebook.training.length<2){$('recovery-models').replaceChildren();$('recovery-plot').replaceChildren();$('recovery-qualification').textContent='Add two distinct training delays to freeze recovery forecasts.';return;}
  const result=evaluateRecovery(notebook);$('recovery-models').replaceChildren();
  result.fit.candidates.forEach((c,i)=>{const tr=document.createElement('tr');for(const value of [c.kind==='decay'?'A exp(−delay / '+c.tauSeconds+' s)':c.kind==='zero'?'Zero contrast':'Persistent A',fmt(c.amplitude),c.status,result.tests[i].status]){const td=document.createElement('td');td.textContent=value;tr.append(td);}tr.firstChild.style.color=colors[i%colors.length];$('recovery-models').append(tr);});
  $('recovery-qualification').textContent='White circles: training. Amber squares: separate challenges. Solid: compatible training hypothesis; dashed: refused. '+result.qualification;plot(result);
 }
 $('recovery-load').onclick=()=>handle(()=>{notebook=recoveryFixture($('recovery-demo').value);render();});
 $('recovery-reset').onclick=()=>handle(()=>{const evidence=currentEvidence();notebook={schema:RECOVERY_SCHEMA,source:evidence.source,protocolId:'fixed-preparation',protocolNote:'Describe the same preparation and matched readout for every recording.',amplitudeBounds:[-1,1],tauSeconds:[.5,1,2,4,8],training:[],challenges:[]};render();});
 $('recovery-add').onclick=()=>handle(()=>{
  if(!$('recovery-delay').value.trim())throw new Error('Enter a recovery delay.');
  const next=structuredClone(notebook);next.protocolNote=$('recovery-protocol').value;
  const run={recordingId:$('recovery-recording').value,protocolId:next.protocolId,delaySeconds:Number($('recovery-delay').value),evidence:structuredClone(currentEvidence())};
  if(next.source!==run.evidence.source)throw new Error('Start a new course to change the evidence source.');
  next[$('recovery-role').value==='training'?'training':'challenges'].push(run);
  if(next.training.length>=2) evaluateRecovery(next);
  else if(!Number.isFinite(run.delaySeconds)||run.delaySeconds<0||run.delaySeconds>60||!/^[A-Za-z0-9_:-]{1,80}$/.test(run.recordingId))throw new Error('Use a valid recording identity and delay from 0 to 60 seconds.');
  notebook=next;render();
 });
 $('recovery-export').onclick=()=>handle(()=>{const url=URL.createObjectURL(new Blob([exportRecovery(notebook)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='worldlaw-recovery-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('recovery-import').onclick=()=>$('recovery-file').click();
 $('recovery-file').onchange=async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>2000000)throw new Error('Use JSON under 2 MB.');const next=importRecovery(await f.text());evaluateRecovery(next);notebook=next;render();$('recovery-error').hidden=true;}catch(err){$('recovery-error').hidden=false;$('recovery-error').textContent=err.message;}finally{e.target.value='';}};
 render();
}
