import {identifyInertia} from './inertia-identification.mjs';
import {readInertiaRecord} from './inertia-record.mjs';
import {readInertiaSettings} from './inertia-investigation.mjs';
import {challengeInertia,readInertiaChallenge,readInertiaChallengeSettings,exportInertiaChallenge} from './inertia-challenge.mjs';
import {createInertiaChallengeExample} from './inertia-challenge-example.mjs';

const NS='http://www.w3.org/2000/svg',colors=['#64e0ce','#c7a4ff'];
const fmt=n=>Number.isFinite(n)?Number(n.toPrecision(6)).toString():'—';
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const svg=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};

/** Independent frozen inputs: changing the investigation above never replaces these. */
export function mountInertiaChallenge(root,{getTraining}){
 root.innerHTML=`<section class="inertia-challenge" aria-labelledby="challenge-title">
  <div class="inertia-heading"><div><p class="eyebrow">FREEZE A CANDIDATE → CHANGE THE MOTION → TEST ITS BALANCE</p><h3 id="challenge-title">Does the same law survive another motion?</h3></div><p>Freeze the training inputs, then bring separate synchronized angles and torque. Challenge observations never change the five coefficients.</p></div>
  <div class="inertia-actions"><button type="button" id="challenge-freeze">Freeze current training above</button><button type="button" id="challenge-positive">Load authored passing pair</button><button type="button" id="challenge-negative">Load authored missing-force pair</button></div>
  <div class="challenge-custody"><p id="challenge-training">No training inputs frozen.</p><p id="challenge-coefficients">Fit a source above and freeze it, or load an authored pair.</p><p id="challenge-training-description" class="small"></p></div>
  <div class="inertia-actions"><button type="button" id="challenge-open">Open challenge / saved inputs</button><button type="button" id="challenge-save" disabled>Save frozen comparison inputs</button></div><input id="challenge-file" type="file" accept=".json,application/json" aria-label="Choose separate challenge source or frozen comparison" hidden>
  <p id="challenge-source" class="inertia-source">No separate challenge source.</p><p id="challenge-description" class="small"></p><p id="challenge-torque" class="small"></p>
  <form id="challenge-form" novalidate><div class="inertia-settings"><label>Challenge rows per window<input id="challenge-width" type="number" min="5" max="401" step="1" value="81"></label><label>Challenge stride<input id="challenge-stride" type="number" min="1" max="400" step="1" value="40"></label><label>Coordinate 1 tolerance · N·m<input id="challenge-tolerance-0" type="number" min="0" max="1000000" step="any" value="0.01"></label><label>Coordinate 2 tolerance · N·m<input id="challenge-tolerance-1" type="number" min="0" max="1000000" step="any" value="0.01"></label></div>
  <label for="challenge-correspondence">Declare shared apparatus, angle order/sign and torque conventions</label><textarea id="challenge-correspondence" maxlength="1000" rows="3" placeholder="Explain why frozen training and this challenge share these physical and coordinate conventions."></textarea>
  <p class="small">Tolerances apply to every weighted torque-balance residual. They are declared decision limits, not calibrated sensor-error intervals. Set them before interpreting the result.</p><button id="challenge-run" type="submit" disabled>Evaluate frozen coefficients</button></form>
  <p id="challenge-error" role="alert" tabindex="-1" hidden></p><p id="challenge-status" role="status" aria-live="polite">No frozen comparison evaluated.</p>
  <div id="challenge-inspection" hidden><label for="challenge-course">Separate-source motion course</label><select id="challenge-course"></select>
   <div id="challenge-instruments" class="challenge-instruments">
    <figure class="challenge-motion"><figcaption>01 · Original challenge motion</figcaption><div id="challenge-motion-plot" role="img" aria-label="Original supplied challenge angles with selected window"></div></figure>
    <figure class="challenge-balance"><figcaption>02 · Supplied torque meets the frozen law</figcaption><div id="challenge-balance-plot" role="img" aria-label="Weighted supplied torque compared with unchanged frozen-coefficient balance"></div></figure>
    <figure class="challenge-residual"><figcaption>03 · Where the balance fails</figcaption><div id="challenge-residual-plot" role="img" aria-label="Weighted torque residuals and declared per-coordinate tolerance lines"></div></figure>
   </div>
   <p class="small">Mint: coordinate 1. Violet: coordinate 2. Motion lines join original angles. Balance solid lines join weighted supplied torques; dashed lines use frozen coefficients and observed angles. Residual dotted lines mark each coordinate’s ±tolerance. No curve is a future-motion forecast.</p>
   <label for="challenge-window">Inspect a source window <output id="challenge-window-label"></output></label><input id="challenge-window" type="range" min="0" max="0" value="0"><p id="challenge-window-readout" class="small"></p><p id="challenge-coarse-window" class="small"></p>
  </div>
  <p id="challenge-sampling" class="small"></p>
  <p class="inertia-qualification"><strong>Compatibility with supplied evidence.</strong> Small weighted residuals do not establish complete forcing, physical inertia, independent acquisition or future-motion accuracy. Labels and repeated-value screening cannot authenticate source independence. Overlapping windows are correlated; window width changes filtering and can suppress residual frequencies.</p>
 </section>`;
 const $=id=>root.querySelector('#'+id);
 let training=null,challenge=null,frozen=null,result=null,generation=0,selected=0;
 function clearError(){$('challenge-error').hidden=true;}
 function error(e){$('challenge-error').textContent=e.message||String(e);$('challenge-error').hidden=false;$('challenge-error').focus();}
 function settings(){return readInertiaChallengeSettings({windowSamples:$('challenge-width').valueAsNumber,stride:$('challenge-stride').valueAsNumber,toleranceNm:[0,1].map(j=>$('challenge-tolerance-'+j).valueAsNumber),correspondence:$('challenge-correspondence').value});}
 function setSettings(s){$('challenge-width').value=s.windowSamples;$('challenge-stride').value=s.stride;[0,1].forEach(j=>$('challenge-tolerance-'+j).value=s.toleranceNm[j]);$('challenge-correspondence').value=s.correspondence;}
 function invalidate(message){result=null;selected=0;$('challenge-status').textContent=message;$('challenge-status').removeAttribute('data-outcome');$('challenge-sampling').textContent='';$('challenge-window-readout').textContent='';$('challenge-coarse-window').textContent='';$('challenge-inspection').hidden=true;$('challenge-save').disabled=true;}
 function trainingFit(value){if(!value)throw new Error('Fit an admissible training source above before freezing.');const next={record:readInertiaRecord(value.record),settings:readInertiaSettings(value.settings)},fit=identifyInertia(next.record,next.settings);if(fit.primary.status!=='candidate')throw new Error('Training must support positive-definite inertia and nonnegative damping before freezing.');return {next,coefficients:[...fit.primary.coefficients]};}
 function showCustody(){
  $('challenge-training').textContent=training?`FROZEN TRAINING · ${training.record.source.label} · ${training.settings.windowSamples} rows/window · stride ${training.settings.stride}. Changing the source above leaves this snapshot unchanged.`:'No training inputs frozen.';
  $('challenge-coefficients').textContent=frozen?`M = [[${fmt(frozen[0])}, ${fmt(frozen[1])}], [${fmt(frozen[1])}, ${fmt(frozen[2])}]] kg·m²; D = [${fmt(frozen[3])}, ${fmt(frozen[4])}] N·m·s/rad. Frozen from training only.`:'';
  $('challenge-training-description').textContent=training?training.record.source.description+' Training torque declaration: '+training.record.torqueDeclaration:'';
  $('challenge-source').textContent=challenge?`CHALLENGE · ${challenge.source.label} · ${challenge.courses.reduce((n,c)=>n+c.rows.length,0)} original rows`:'No separate challenge source.';
  $('challenge-description').textContent=challenge?.source.description??'';$('challenge-torque').textContent=challenge?'Challenge torque declaration: '+challenge.torqueDeclaration:'';
  $('challenge-run').disabled=!(training&&challenge);
 }
 function course(){return challenge?.courses[Number($('challenge-course').value)||0];}
 function chart(container,series,{label,domain,band,tolerances}){
  const W=root.getBoundingClientRect().width<700?410:1000,H=240,left=98,right=25,top=20,bottom=45,points=series.flatMap(s=>s.points);
  if(!points.length){container.replaceChildren();return;}
  const [minX,maxX]=domain;let minY=Math.min(...points.map(p=>p[1]),...(tolerances??[]).map(t=>-t)),maxY=Math.max(...points.map(p=>p[1]),...(tolerances??[]));
  const pad=Math.max(1e-7,(maxY-minY)*.1);minY-=pad;maxY+=pad;
  const x=v=>left+(v-minX)/(maxX-minX||1)*(W-left-right),y=v=>H-bottom-(v-minY)/(maxY-minY)*(H-top-bottom),s=svg('svg',{viewBox:`0 0 ${W} ${H}`,role:'presentation'});
  if(band)s.append(svg('rect',{x:x(band[0]),y:top,width:x(band[1])-x(band[0]),height:H-top-bottom,fill:'#ffc65d',opacity:.13,'data-challenge-window':'true'}));
  for(let i=0;i<=4;i++){const t=minX+(maxX-minX)*i/4,v=minY+(maxY-minY)*i/4;s.append(svg('line',{x1:left,x2:W-right,y1:y(v),y2:y(v),stroke:'#35475e'}),svg('text',{x:x(t),y:H-23,'text-anchor':'middle','font-size':12},Number(t.toPrecision(3)).toString()),svg('text',{x:left-7,y:y(v)+4,'text-anchor':'end','font-size':12},Number(v.toPrecision(3)).toString()));}
  tolerances?.forEach((t,j)=>[-1,1].forEach(sign=>s.append(svg('line',{x1:left,x2:W-right,y1:y(sign*t),y2:y(sign*t),stroke:colors[j],'stroke-dasharray':j?'1 5':'2 5','data-challenge-tolerance':j}))));
  for(const line of series)s.append(svg('path',{d:line.points.map((p,i)=>(i?'L':'M')+x(p[0])+' '+y(p[1])).join(' '),fill:'none',stroke:line.color,'stroke-width':2.4,'stroke-dasharray':line.dashed?'7 5':'','data-challenge-trace':line.dashed?'frozen':'observed'}));
  s.append(svg('text',{x:(W+left-right)/2,y:H-5,'text-anchor':'middle','font-size':12},'Original challenge time · s'),svg('text',{x:15,y:H/2,transform:`rotate(-90 15 ${H/2})`,'text-anchor':'middle','font-size':12},label));container.replaceChildren(s);
 }
 function draw(){
  $('challenge-inspection').hidden=!result;if(!result)return;const c=course(),rows=result.primary.rows.filter(r=>r.courseId===c.id),windows=rows.filter(r=>r.axis===0),w=windows[selected],domain=[c.rows[0].time,c.rows.at(-1).time],band=[w.start,w.end];
  chart($('challenge-motion-plot'),[0,1].map(j=>({color:colors[j],points:c.rows.map(r=>[r.time,r.position[j]])})),{label:'Angle · rad',domain,band});
  const balance=[],residual=[];for(let j=0;j<2;j++){const a=rows.filter(r=>r.axis===j),time=r=>(r.start+r.end)/2;balance.push({color:colors[j],points:a.map(r=>[time(r),r.observedTorque])},{color:colors[j],dashed:true,points:a.map(r=>[time(r),r.predictedTorque])});residual.push({color:colors[j],points:a.map(r=>[time(r),r.residual])});}
  chart($('challenge-balance-plot'),balance,{label:'Weighted torque · N·m',domain,band});chart($('challenge-residual-plot'),residual,{label:'Residual · N·m',domain,band,tolerances:result.settings.toleranceNm});
  $('challenge-window').max=windows.length-1;$('challenge-window').value=selected;$('challenge-window-label').textContent=`${selected+1} / ${windows.length}`;
  const pair=rows.filter(r=>r.firstRow===w.firstRow&&r.lastRow===w.lastRow);
  $('challenge-window-readout').textContent=`${c.id} · original source rows ${w.firstRow+1}–${w.lastRow+1} · ${fmt(w.start)}–${fmt(w.end)} s. `+pair.map(r=>`Coordinate ${r.axis+1}: supplied ${fmt(r.observedTorque)}, frozen ${fmt(r.predictedTorque)}, residual ${fmt(r.residual)} N·m; ${r.withinDeclaredTolerance?'within':'outside'} ±${fmt(r.tolerance)} N·m.`).join(' ')+' Row numbers count from 1.';
  const alternate=result.samplingComparison.alternate?.rows.filter(r=>r.courseId===c.id&&r.axis===0)??[],coarse=alternate.length?alternate.reduce((a,b)=>Math.abs(b.start-w.start)<Math.abs(a.start-w.start)?b:a):null;
  $('challenge-coarse-window').textContent=coarse?`Nearest-start coarser window: original rows ${coarse.firstRow+1}–${coarse.lastRow+1}, ${fmt(coarse.start)}–${fmt(coarse.end)} s; this may have different endpoints. `+result.samplingComparison.alternate.rows.filter(r=>r.courseId===c.id&&r.firstRow===coarse.firstRow).map(r=>`Coordinate ${r.axis+1} residual ${fmt(r.residual)} N·m.`).join(' '):'No supported coarser window.';
 }
 function display(next){
  result=next;selected=0;$('challenge-course').replaceChildren(...challenge.courses.map((c,i)=>el('option',c.id,{value:i})));
  const p=result.primary,a=result.samplingComparison.alternate;$('challenge-status').dataset.outcome=p.status;
  $('challenge-status').textContent=`${p.outside?'Exceeds':'Within'} declared weighted-torque tolerances · ${p.outside} / ${p.equations} equations outside · RMSE ${fmt(p.rmseNm)} N·m · maximum ${fmt(p.maximumAbsoluteResidualNm)} N·m. ${p.windowCount} windows; five unchanged training coefficients; no challenge refit.`;
  $('challenge-sampling').textContent=`Challenge library rank ${p.rank}/5 (excitation diagnostic, not identification). `+(a?`Every-second-row challenge: RMSE ${fmt(a.rmseNm)} N·m, maximum ${fmt(a.maximumAbsoluteResidualNm)} N·m, ${a.outside}/${a.equations} equations outside. `:'No supported coarser comparison. ')+result.samplingComparison.meaning;
  $('challenge-save').disabled=false;clearError();showCustody();draw();
 }
 function evaluate(){try{if(!training||!challenge)throw new Error('Freeze training and open a separate challenge first.');display(challengeInertia(training,challenge,settings()));}catch(e){invalidate('Comparison refused. Correct the inputs; frozen training remains unchanged.');error(e);}}
 function loadPair(input){const parsed=readInertiaChallenge(input),next=challengeInertia(parsed.training,parsed.challenge,parsed.settings);training=parsed.training;challenge=parsed.challenge;frozen=[...next.coefficients];setSettings(parsed.settings);display(next);}
 $('challenge-freeze').addEventListener('click',()=>{generation++;try{const {next,coefficients}=trainingFit(getTraining());training=next;frozen=coefficients;$('challenge-correspondence').value='';invalidate('Training snapshot replaced explicitly. Evaluate the separate challenge with these coefficients.');clearError();showCustody();}catch(e){invalidate('Training freeze refused. Any previous training snapshot remains unchanged.');error(e);}});
 for(const[id,omittedForce]of [['challenge-positive',false],['challenge-negative',true]])$(id).addEventListener('click',()=>{generation++;try{loadPair(createInertiaChallengeExample({omittedForce}));}catch(e){invalidate('Authored comparison refused.');error(e);}});
 $('challenge-form').addEventListener('input',()=>{generation++;invalidate('Challenge settings changed. Evaluate again; training coefficients remain frozen.');clearError();});
 $('challenge-form').addEventListener('submit',e=>{e.preventDefault();generation++;evaluate();});
 $('challenge-course').addEventListener('change',()=>{selected=0;draw();});$('challenge-window').addEventListener('input',()=>{selected=Number($('challenge-window').value);draw();});
 $('challenge-open').addEventListener('click',()=>$('challenge-file').click());
 $('challenge-file').addEventListener('change',async()=>{const file=$('challenge-file').files?.[0];$('challenge-file').value='';if(!file)return;const ticket=++generation;invalidate('Opening separate comparison inputs…');clearError();try{if(file.size>7*1024*1024)throw new Error('Comparison input exceeds 7 MiB.');const text=await file.text();if(ticket!==generation)return;const value=JSON.parse(text);if(value?.schema==='worldlaw.coupled-inertia-challenge/v1'){loadPair(value);}else{const admitted=readInertiaRecord(text);challenge=admitted;$('challenge-correspondence').value='';showCustody();invalidate('Separate source loaded. Declare its correspondence and evaluate against frozen training.');}}catch(e){if(ticket===generation){invalidate('New input refused. Previously admitted sources remain unchanged; evaluate again to inspect them.');error(e);}}});
 $('challenge-save').addEventListener('click',()=>{try{if(!result)throw new Error('Evaluate current inputs before saving.');const text=exportInertiaChallenge(training,challenge,settings()),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=el('a',undefined,{href:url,download:'worldlaw-frozen-inertia-challenge.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){error(e);}});
 let resize;window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(draw);});
 return {redraw:draw};
}
