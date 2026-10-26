import {mountVelocityComparison} from './velocity-panel.mjs';
import {mountInertiaChallenge} from './inertia-challenge-panel.mjs';
import {mountViscousComparison} from './viscous-panel.mjs';
import {identifyInertia} from './inertia-identification.mjs';
import {createInertiaExample} from './inertia-example.mjs';
import {createInertiaCounterexample} from './inertia-counterexample.mjs';
import {readInertiaInvestigation,readInertiaSettings,exportInertiaInvestigation} from './inertia-investigation.mjs';

const NS='http://www.w3.org/2000/svg',colors=['#64e0ce','#c7a4ff'];
const fmt=n=>Number.isFinite(n)?Number(n.toPrecision(6)).toString():'—';
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const svg=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};

export function mountInertiaIdentification(root,{applyParameters,getNotebook,applyRelease}){
  root.innerHTML=`
    <details id="inertia-lab"><summary>Estimate inertia from a separate motion record</summary>
      <div class="inertia-heading"><div><p class="eyebrow">MOTION → DECLARED BALANCE → CONDITIONAL VALUES</p><h3>Can one inertia explain these motions?</h3></div><p>Fit a constant symmetric inertia and diagonal viscous loss from synchronized angles and supplied torques. The response notebook above stays separate.</p></div>
      <p class="inertia-equation">M q″ + diag(D) q′ = supplied torque</p>
      <p class="small">Supply the torque associated with each angle, in the same order and sign. Spatial sensor torques may need a coordinate transformation. Include every right-hand-side force except the separately modeled viscous loss.</p>
      <div class="inertia-actions"><button id="inertia-open" type="button">Open motion record</button><button id="inertia-example" type="button">Try authored two-mode fit</button><button id="inertia-counterexample" type="button">Try omitted-force control</button><button id="inertia-save" type="button" disabled>Save investigation inputs</button></div>
      <input id="inertia-file" type="file" accept=".json,application/json" hidden aria-label="Choose inertia observations or investigation">
      <p id="inertia-source" class="inertia-source">No motion record loaded. Source records require seconds, radians and N·m.</p><p id="inertia-description" class="small"></p><p id="inertia-torque" class="small"></p>
      <form id="inertia-form" class="inertia-settings" novalidate><label>Rows per weak window<input id="inertia-width" type="number" min="5" max="401" step="1" value="81"></label><label>Stride in source rows<input id="inertia-stride" type="number" min="1" max="400" step="1" value="40"></label><button id="inertia-fit" type="submit" disabled>Fit the declared balance</button></form>
      <p id="inertia-error" role="alert" tabindex="-1" hidden></p><p id="inertia-status" role="status" aria-live="polite">No balance has been fitted.</p>
      <div id="inertia-inspection" hidden><label for="inertia-course">Original motion course</label><select id="inertia-course"></select><div class="inertia-instruments"><figure><figcaption>Original supplied angles</figcaption><div id="inertia-source-plot" role="img" aria-label="Supplied angles and selected integration window"></div></figure><figure><figcaption>Weak torque balance</figcaption><div id="inertia-balance-plot" role="img" aria-label="Weighted supplied torque and fitted balance at window midpoints"></div></figure></div><p class="small">Mint: coordinate 1. Violet: coordinate 2. Source lines join original samples. In the balance plot, solid lines join weighted supplied torques; dashed lines join fitted balances. Neither is an independent trajectory prediction.</p><label for="inertia-window">Inspect an original-source window <output id="inertia-window-label"></output></label><input id="inertia-window" type="range" min="0" max="0" value="0" disabled><p id="inertia-window-readout" class="small"></p></div>
      <div id="inertia-estimates" class="table-wrap" hidden><table><caption>Unconstrained candidate coefficients and source-sampling sensitivity</caption><thead><tr><th>Parameter</th><th>Original rows</th><th>Every second row</th><th>Absolute difference</th></tr></thead><tbody id="inertia-coefficients"></tbody></table></div>
      <p id="inertia-sampling" class="small"></p>
      <p class="inertia-qualification"><strong>Candidate balance coefficients.</strong> Unmeasured forces or torque/coordinate calibration errors can be absorbed into inertia and damping—even with full rank, tiny residuals and stable coarsening. These diagnostics do not establish physical inertia.</p>
      <div id="inertia-apply-controls" hidden><label class="motion-consent"><input id="inertia-same-apparatus" type="checkbox"><span>I have checked that this motion source and the response notebook describe the same apparatus, angle coordinates and torque conventions.</span></label><button id="inertia-apply" type="button" disabled>Copy values into the motion experiment</button><p class="small">This copies numerical assumptions only. Review the experiment’s declaration before running the retained response laws.</p></div>
      <details class="inertia-method"><summary>What the fit and its diagnostics mean</summary><p>Endpoint-vanishing polynomial windows integrate the supplied angle and torque samples, avoiding pointwise acceleration differences. Quadrature is exact for the represented linear interpolants; observation noise and interpolation bias remain. Overlapping windows are correlated.</p><p>Rank concerns the offered five-column numerical library. The normalized QR pivot ratio is a numerical diagnostic, not a spectral condition number or parameter uncertainty. The coarser source keeps every second original row and the final endpoint; this comparison is not a confidence interval, error bound or new evidence.</p><p>An unconstrained fit outside the supported positive-definite-inertia/nonnegative-damping family is retained but cannot be copied into the solver. It does not prove that every physically plausible model is impossible.</p></details>
      <div id="inertia-challenge-host"></div>
    </details>`;
  const $=id=>root.querySelector('#'+id);
  let record=null,result=null,generation=0,selected=0,pendingRead=false;
  function clearError(){$('inertia-error').hidden=true;}
  function error(e){$('inertia-error').textContent=e.message||String(e);$('inertia-error').hidden=false;$('inertia-error').focus();}
  function settings(){return readInertiaSettings({windowSamples:$('inertia-width').valueAsNumber,stride:$('inertia-stride').valueAsNumber});}
  function invalidate(message){pendingRead=false;result=null;selected=0;$('inertia-status').textContent=message;$('inertia-estimates').hidden=true;$('inertia-coefficients').replaceChildren();$('inertia-apply-controls').hidden=true;$('inertia-apply').disabled=true;$('inertia-same-apparatus').checked=false;$('inertia-window').disabled=true;$('inertia-window-label').textContent='';$('inertia-window-readout').textContent='';$('inertia-sampling').textContent='';draw();}
  function course(){return record?.courses[Number($('inertia-course').value)||0];}
  function windows(){return result?.primary.rows.filter(r=>r.courseId===course()?.id&&r.axis===0)??[];}
  function chart(container,series,{xLabel,yLabel,band}){
    const compact=root.getBoundingClientRect().width<760,W=compact?400:620,H=250,left=68,right=18,top=24,bottom=50;
    const points=series.flatMap(s=>s.points);if(!points.length){container.replaceChildren(el('p','Fit the balance to inspect its weighted windows.',{class:'small'}));return;}
    let minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
    if(minX===maxX){minX-=.5;maxX+=.5;}const pad=Math.max(.000001,(maxY-minY)*.08);minY-=pad;maxY+=pad;
    const x=v=>left+(v-minX)/(maxX-minX)*(W-left-right),y=v=>H-bottom-(v-minY)/(maxY-minY)*(H-top-bottom),s=svg('svg',{viewBox:`0 0 ${W} ${H}`,role:'presentation'});
    if(band)s.append(svg('rect',{x:x(band[0]),y:top,width:Math.max(0,x(band[1])-x(band[0])),height:H-top-bottom,fill:'#ffc65d',opacity:.13,'data-source-window':'true'}));
    for(let i=0;i<=4;i++){const xv=minX+(maxX-minX)*i/4,yv=minY+(maxY-minY)*i/4;s.append(svg('line',{x1:left,x2:W-right,y1:y(yv),y2:y(yv),stroke:'#35475e','stroke-dasharray':'3 5'}),svg('text',{x:x(xv),y:H-bottom+20,'text-anchor':'middle','font-size':12},Number(xv.toPrecision(3)).toString()),svg('text',{x:left-8,y:y(yv)+4,'text-anchor':'end','font-size':12},Number(yv.toPrecision(3)).toString()));}
    for(const line of series)s.append(svg('path',{d:line.points.map((p,i)=>(i?'L':'M')+x(p[0])+' '+y(p[1])).join(' '),fill:'none',stroke:line.color,'stroke-width':line.dashed?2:2.5,'stroke-dasharray':line.dashed?'6 4':'','data-inertia-trace':line.dashed?'fitted':'supplied'}));
    s.append(svg('text',{x:(left+W-right)/2,y:H-8,'text-anchor':'middle','font-size':13},xLabel),svg('text',{x:15,y:(top+H-bottom)/2,transform:`rotate(-90 15 ${(top+H-bottom)/2})`,'text-anchor':'middle','font-size':13},yLabel));container.replaceChildren(s);
  }
  function draw(){
    const c=course();$('inertia-inspection').hidden=!c;if(!c)return;
    const ws=windows(),w=ws[selected];
    chart($('inertia-source-plot'),[0,1].map(axis=>({color:colors[axis],points:c.rows.map(r=>[r.time,r.position[axis]])})),{xLabel:'Original time · s',yLabel:'Angle · rad',band:w?[w.start,w.end]:null});
    const rows=result?.primary.rows.filter(r=>r.courseId===c.id)??[],series=[];
    for(let axis=0;axis<2;axis++){const a=rows.filter(r=>r.axis===axis);series.push({color:colors[axis],points:a.map(r=>[(r.start+r.end)/2,r.observedTorque])});if(a.every(r=>Number.isFinite(r.predictedTorque)))series.push({color:colors[axis],dashed:true,points:a.map(r=>[(r.start+r.end)/2,r.predictedTorque])});}
    chart($('inertia-balance-plot'),series,{xLabel:'Window midpoint · s',yLabel:'Weighted torque · N·m'});
    $('inertia-window').disabled=!ws.length;$('inertia-window').max=String(Math.max(0,ws.length-1));$('inertia-window').value=String(selected);
    $('inertia-window-label').textContent=w?`${selected+1} / ${ws.length}`:'';
    if(w){const pair=rows.filter(r=>r.firstRow===w.firstRow);$('inertia-window-readout').textContent=`${c.id}: source rows ${w.firstRow+1}–${w.lastRow+1}, ${fmt(w.start)}–${fmt(w.end)} s. Weighted balance residuals: ${pair.map(r=>fmt(r.residual)).join(', ')} N·m. Row numbers count from 1.`;}
  }
  function load(input){
    const parsed=readInertiaInvestigation(input);record=parsed.record;$('inertia-width').value=parsed.settings.windowSamples;$('inertia-stride').value=parsed.settings.stride;
    $('inertia-course').replaceChildren(...record.courses.map((c,i)=>el('option',c.id,{value:String(i)})));
    $('inertia-source').textContent=`${record.source.label} · ${record.courses.length} course(s) · ${record.courses.reduce((s,c)=>s+c.rows.length,0)} original rows`;
    $('inertia-description').textContent=record.source.description;$('inertia-torque').textContent='Supplied torque declaration: '+record.torqueDeclaration;
    $('inertia-fit').disabled=false;$('inertia-save').disabled=false;invalidate('Motion record loaded. Fit the declared balance.');clearError();
  }
  function fit(){
    pendingRead=false;try{if(!record)throw new Error('Open a motion record first.');result=identifyInertia(record,settings());selected=0;clearError();const p=result.primary,a=result.samplingComparison.alternate;
      $('inertia-status').textContent=p.status==='unidentified'?`Rank ${p.rank}/5: the supplied course does not identify all five offered coefficients.`:`${p.status==='candidate'?'Candidate balance':'Outside supported simulation family'} · rank ${p.rank}/5 · ${p.windowCount} windows · weak torque-balance RMSE ${fmt(p.meanTorqueBalanceRmse)} N·m · normalized QR pivot ratio ${fmt(p.conditionEstimate)}.${p.refusal?' '+p.refusal:''}`;
      $('inertia-coefficients').replaceChildren();if(p.coefficients)p.coefficients.forEach((v,i)=>{const tr=el('tr');tr.append(el('th',p.parameters[i]+(i<3?' · kg·m²':' · N·m·s/rad'),{scope:'row'}),el('td',fmt(v)),el('td',fmt(a?.coefficients?.[i])),el('td',fmt(result.samplingComparison.absoluteCoefficientDifferences?.[i])));$('inertia-coefficients').append(tr);});
      $('inertia-estimates').hidden=!p.coefficients;$('inertia-sampling').textContent=`${result.diagnostics.reservedSegments} / ${result.diagnostics.segmentBudget} quadrature segments reserved across both calculations. `+(a?`Coarser-source rank ${a.rank}/5, status ${a.status}. `:'This window width does not support a coarser-source comparison. ')+result.samplingComparison.meaning;
      $('inertia-apply-controls').hidden=!p.simulationParameters;$('inertia-same-apparatus').checked=false;$('inertia-apply').disabled=true;draw();
    }catch(e){invalidate('No current fit. Correct the source or window settings.');error(e);}
  }
  $('inertia-form').addEventListener('submit',e=>{e.preventDefault();generation++;fit();});
  $('inertia-form').addEventListener('input',()=>{generation++;invalidate('Window settings changed. Fit again to inspect current coefficients.');clearError();});
  for(const [id,make]of [['inertia-example',createInertiaExample],['inertia-counterexample',createInertiaCounterexample]])$(id).addEventListener('click',()=>{generation++;load(make());fit();});
  $('inertia-course').addEventListener('change',()=>{selected=0;draw();});$('inertia-window').addEventListener('input',()=>{selected=Number($('inertia-window').value);draw();});
  $('inertia-same-apparatus').addEventListener('change',()=>{$('inertia-apply').disabled=!$('inertia-same-apparatus').checked||!result?.primary.simulationParameters;});
  $('inertia-apply').addEventListener('click',()=>{if(!result?.primary.simulationParameters||!$('inertia-same-apparatus').checked)return;applyParameters(structuredClone(result.primary.simulationParameters),record.source.label);$('inertia-same-apparatus').checked=false;$('inertia-apply').disabled=true;});
  $('inertia-open').addEventListener('click',()=>$('inertia-file').click());
  $('inertia-file').addEventListener('change',async()=>{const file=$('inertia-file').files?.[0];$('inertia-file').value='';if(!file)return;const ticket=++generation;invalidate('Opening a motion record…');pendingRead=true;try{if(file.size>3*1024*1024)throw new Error('Inertia investigation exceeds 3 MB.');const text=await file.text();if(ticket!==generation)return;load(text);fit();}catch(e){if(ticket===generation){pendingRead=false;$('inertia-status').textContent='The new motion record was refused. Any displayed source remains the previously admitted record.';error(e);}}});
  $('inertia-save').addEventListener('click',()=>{try{if(!record)throw new Error('Open a motion record first.');const text=exportInertiaInvestigation(record,settings()),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=el('a',undefined,{href:url,download:'worldlaw-inertia-investigation.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);clearError();}catch(e){error(e);}});
  const challengePanel=mountInertiaChallenge($('inertia-challenge-host'),{getTraining:()=>result?.primary.status==='candidate'?{record,settings:settings()}:null});
  const viscousHost=document.createElement('div');viscousHost.id='inertia-viscous-host';$('inertia-challenge-host').after(viscousHost);
  const viscousPanel=mountViscousComparison(viscousHost,{applyParameters,getNotebook,applyRelease});
  const velocityHost=document.createElement('div');velocityHost.id='inertia-velocity-host';viscousHost.after(velocityHost);const velocityPanel=mountVelocityComparison(velocityHost,{applyParameters,getNotebook});
  let resize;window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(draw);});$('inertia-lab').addEventListener('toggle',()=>{if($('inertia-lab').open){draw();challengePanel.redraw();}});
  return {contextChanged(){generation++;viscousPanel.contextChanged();velocityPanel.contextChanged();if(pendingRead){pendingRead=false;$('inertia-status').textContent='Response notebook changed. Pending motion-file read canceled; open again or refit the displayed source.';}$('inertia-same-apparatus').checked=false;$('inertia-apply').disabled=true;}};
}

