import {appendModeInspection} from './modes-panel.mjs';
import {mountInertiaIdentification} from './inertia-identification-panel.mjs';
import {MATRIX_INPUT_SCHEMA,MATRIX_INTERPRETATION,LOSS_INPUT_SCHEMA,LOSS_INTERPRETATION,defaultDynamicsInputs,readDynamicsInputs,createCoupledDynamicsStudy,exportDynamicsNotebook,readDynamicsNotebook} from './dynamics.mjs';

const NS='http://www.w3.org/2000/svg',palette=['#c7a4ff','#ffc65d','#64e0ce','#fe9b9b','#80c8ff','#f1a7e4'];
const fmt=n=>n===null||n===undefined?'—':Math.abs(n)>=1e4||Math.abs(n)>0&&Math.abs(n)<.00001?n.toExponential(3):Number(n.toFixed(5)).toString();
const node=(tag,text,attributes={})=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;for(const[k,v]of Object.entries(attributes))el.setAttribute(k,v);return el;};
const svg=(tag,attributes={},text)=>{const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attributes))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};

export function mountCoupledDynamics(root,{getNotebook,loadNotebook}) {
  root.innerHTML=`
    <div class="motion-heading"><div><p class="eyebrow">SAME EVIDENCE. DIFFERENT MOTION.</p><h2 id="motion-title">Let the laws move.</h2></div><p>Explore what each fitted response would do under the same declared dynamic assumptions. The fitted response evidence remains quasi-static; a separate motion record can supply conditional inertia assumptions.</p></div>
    <div class="motion-layout">
      <div class="motion-instrument">
        <div class="instrument-bar"><h3>Conditional free response</h3><div class="view-controls" role="group" aria-label="Motion visualization"><button id="motion-phase" type="button" aria-pressed="true">Coupled path</button><button id="motion-traces" type="button" aria-pressed="false">Angle traces</button></div></div>
        <div id="motion-plot" role="img" aria-label="Conditional predicted motion of the fitted two-coordinate laws"><p class="motion-empty">Set the initial state, declare the dynamics and compare the responses.</p></div>
        <div id="motion-legend" class="legend"></div>
        <div class="motion-playback"><button id="motion-play" type="button" disabled>Play</button><label for="motion-frame">Inspect time <output id="motion-time">0 s</output></label><input id="motion-frame" type="range" min="0" max="240" value="0" disabled aria-label="Inspect predicted time"></div>
        <p id="motion-plot-note" class="plot-note">These are predicted coordinates, not reconstructed bodies. Separate observed checks never train or select the motion.</p>
        <p id="motion-equation" class="inertia-equation">M q″ + diag(D) q′ = τ(q)</p>
      </div>
      <form id="motion-form" class="motion-controls" novalidate>
        <h3>Declare the experiment</h3><p class="small">τ(q) is interpreted as a net position-dependent driving torque, before the loss below. Cross inertia couples acceleration; symmetric cross loss couples velocity. Neither adds a position-torque law. No configuration-dependent inertia, nonlinear loss, constraint or external input is modeled.</p>
        <div class="pair-inputs"><label>Inertia 1 · kg·m²<input id="motion-inertia-0" type="number" step="any" min=".000000001"></label><label>Inertia 2 · kg·m²<input id="motion-inertia-1" type="number" step="any" min=".000000001"></label></div>
        <label for="motion-inertia-kind">Inertial relationship</label><select id="motion-inertia-kind"><option value="diagonal">Separate diagonal inertias</option><option value="symmetric">Symmetric inertia matrix</option></select>
        <div id="motion-cross-controls" hidden><label for="motion-inertia-cross">Shared cross inertia · kg·m²</label><input id="motion-inertia-cross" type="number" step="any" value="0" aria-describedby="motion-inertia-note"><p id="motion-inertia-note" class="small">M = [[inertia 1, cross], [cross, inertia 2]]. Positive-definite, numerically supported declarations only. Both signs are allowed; these values are supplied assumptions.</p></div>
        <div class="pair-inputs"><label>Damping 1 · N·m·s/rad<input id="motion-damping-0" type="number" step="any" min="0"></label><label>Damping 2 · N·m·s/rad<input id="motion-damping-1" type="number" step="any" min="0"></label></div>
        <label for="motion-loss-kind">Viscous-loss relationship</label><select id="motion-loss-kind"><option value="diagonal">Independent diagonal loss</option><option value="symmetric">Symmetric loss matrix</option></select>
        <div id="motion-loss-controls" hidden><label for="motion-damping-cross">Shared cross loss · N·m·s/rad</label><input id="motion-damping-cross" type="number" step="any" value="0" aria-describedby="motion-loss-note"><p id="motion-loss-note" class="small">D = [[damping 1, cross], [cross, damping 2]]. Either sign is allowed within the positive-semidefinite family. Admission is a conditional model check, not physical validation.</p></div>
        <div class="pair-inputs"><label>Initial angle 1 · rad<input id="motion-position-0" type="number" step="any"></label><label>Initial angle 2 · rad<input id="motion-position-1" type="number" step="any"></label></div>
        <div class="pair-inputs"><label>Initial rate 1 · rad/s<input id="motion-rate-0" type="number" step="any"></label><label>Initial rate 2 · rad/s<input id="motion-rate-1" type="number" step="any"></label></div>
        <div class="pair-inputs"><label>Duration · s<input id="motion-duration" type="number" step="any" min=".000001" max="100"></label><label>Maximum step · s<input id="motion-step" type="number" step="any" min=".00000001" max="1"></label></div>
        <details><summary>Numerical comparison and declaration</summary><div class="pair-inputs"><label>Angle tolerance · rad<input id="motion-angle-tolerance" type="number" step="any"></label><label>Rate tolerance · rad/s<input id="motion-rate-tolerance" type="number" step="any"></label></div><label for="motion-declaration">Source of the dynamic assumptions</label><textarea id="motion-declaration" rows="3" maxlength="1000"></textarea><p class="small">Compare two nested step sizes at 241 common output times. Agreement is not a numerical error bound or physical validation.</p></details>
        <label class="motion-consent"><input id="motion-declared" type="checkbox"><span>I declare this dynamic interpretation and these inertia/damping values for this exploration.</span></label>
        <button id="motion-run" type="submit" class="primary">Compare the motion</button>
      </form>
    </div>
    <p id="motion-error" role="alert" tabindex="-1" hidden></p>
    <p id="motion-status" role="status" aria-live="polite">No dynamic comparison has been run.</p>
    <div class="table-wrap" id="motion-results" hidden><table><caption>All fitted explanations are shown. Training rank and step agreement do not establish the dynamic assumptions.</caption><thead><tr><th>Explanation</th><th>Step comparison</th><th>Max angle difference</th><th>Max rate difference</th><th>Observed position range</th></tr></thead><tbody id="motion-rows"></tbody></table></div>
    <section id="motion-modes" aria-label="Useful coordinates for the retained motion"></section>
    <div class="motion-files"><button id="motion-save" type="button">Save motion inputs</button><button id="motion-open" type="button">Open motion inputs</button><span>Evidence and declarations only; models and trajectories are recomputed.</span></div>
    <input id="motion-file" type="file" accept=".json,application/json" hidden aria-label="Choose coupled motion notebook">
    <section id="motion-inertia-identification" class="inertia-identification" aria-label="Inertia from synchronized motion"></section>
  `;
  const $=id=>root.querySelector('#'+id);
  let study=null,retainedEvidence=null,view='phase',frame=0,raf=null,playing=false,previousStamp=null,generation=0;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function stop(){playing=false;if(raf!==null)cancelAnimationFrame(raf);raf=null;previousStamp=null;$('motion-play').textContent='Play';}
  function error(err){stop();$('motion-error').textContent=err.message||String(err);$('motion-error').hidden=false;$('motion-error').focus();}
  function clearError(){$('motion-error').hidden=true;}
  const matrixDeclaration='Authored exploration: constant symmetric inertia and separately declared viscous damping; no physical calibration.';
  const lossDeclaration='Authored exploration: constant symmetric inertia and symmetric viscous loss; no physical calibration.';
  function syncInertiaControls() {
    const matrix=$('motion-inertia-kind').value==='symmetric';
    $('motion-cross-controls').hidden=!matrix;$('motion-inertia-cross').disabled=!matrix;
    const loss=$('motion-loss-kind').value==='symmetric';
    $('motion-loss-controls').hidden=!loss;$('motion-damping-cross').disabled=!loss;
    $('motion-equation').textContent=loss?'M q″ + D q′ = τ(q)':'M q″ + diag(D) q′ = τ(q)';
  }
  function setInputs(input,declared=false) {
    for(const [name,key]of [['inertia','inertia'],['damping','damping'],['position','initialPosition'],['rate','initialRate']])for(let a=0;a<2;a++)$('motion-'+name+'-'+a).value=input[key][a];
    for(const [id,key]of [['duration','duration'],['step','maxStep'],['angle-tolerance','positionTolerance'],['rate-tolerance','rateTolerance']])$('motion-'+id).value=input[key];
    $('motion-declaration').value=input.declaration;$('motion-declared').checked=declared;
    root.dataset.samples=String(input.samples);
    $('motion-inertia-kind').value=[MATRIX_INPUT_SCHEMA,LOSS_INPUT_SCHEMA].includes(input.schema)?'symmetric':'diagonal';
    $('motion-inertia-cross').value=input.inertiaCross??0;
    $('motion-loss-kind').value=input.schema===LOSS_INPUT_SCHEMA?'symmetric':'diagonal';
    $('motion-damping-cross').value=input.dampingCross??0;syncInertiaControls();
  }
  function inputs() {
    if(!$('motion-declared').checked)throw new Error('Declare the dynamic interpretation before running or saving this exploration.');
    const result=defaultDynamicsInputs();
    for(const [name,key]of [['inertia','inertia'],['damping','damping'],['position','initialPosition'],['rate','initialRate']])result[key]=[0,1].map(a=>$('motion-'+name+'-'+a).valueAsNumber);
    for(const [id,key]of [['duration','duration'],['step','maxStep'],['angle-tolerance','positionTolerance'],['rate-tolerance','rateTolerance']])result[key]=$('motion-'+id).valueAsNumber;
    result.declaration=$('motion-declaration').value;result.samples=Number(root.dataset.samples);
    if($('motion-inertia-kind').value==='symmetric'){
      result.schema=MATRIX_INPUT_SCHEMA;result.interpretation=MATRIX_INTERPRETATION;result.inertiaCross=$('motion-inertia-cross').valueAsNumber;
    }
    if($('motion-loss-kind').value==='symmetric'){
      result.schema=LOSS_INPUT_SCHEMA;result.interpretation=LOSS_INTERPRETATION;result.inertiaCross??=0;result.dampingCross=$('motion-damping-cross').valueAsNumber;
    }
    return readDynamicsInputs(result);
  }
  function invalidate(message) {
    stop();study=null;retainedEvidence=null;$('motion-modes').replaceChildren();frame=0;$('motion-frame').value='0';$('motion-frame').disabled=true;$('motion-play').disabled=true;
    $('motion-results').hidden=true;$('motion-rows').replaceChildren();$('motion-legend').replaceChildren();
    $('motion-plot').replaceChildren(node('p',message,{class:'motion-empty'}));$('motion-time').textContent='0 s';$('motion-status').textContent=message;
  }
  function axes(stage,{left=65,top=30,width=620,height=300,minX,maxX,minY,maxY,xLabel,yLabel}) {
    if(maxX===minX){minX-=.1;maxX+=.1;}if(maxY===minY){minY-=.1;maxY+=.1;}
    const x=value=>left+(value-minX)/(maxX-minX)*width,y=value=>top+height-(value-minY)/(maxY-minY)*height;
    for(let i=0;i<=4;i++){
      const xx=left+i*width/4,yy=top+i*height/4;
      stage.append(svg('line',{x1:xx,x2:xx,y1:top,y2:top+height,stroke:'#35475e','stroke-dasharray':'3 5'}),svg('line',{x1:left,x2:left+width,y1:yy,y2:yy,stroke:'#35475e','stroke-dasharray':'3 5'}));
      stage.append(svg('text',{x:xx,y:top+height+20,'text-anchor':'middle','font-size':13},Number((minX+i*(maxX-minX)/4).toPrecision(3)).toString()));
      stage.append(svg('text',{x:left-9,y:yy+4,'text-anchor':'end','font-size':13},Number((maxY-i*(maxY-minY)/4).toPrecision(3)).toString()));
    }
    stage.append(svg('text',{x:left+width/2,y:top+height+44,'text-anchor':'middle','font-size':14},xLabel),svg('text',{x:17,y:top+height/2,transform:'rotate(-90 17 '+(top+height/2)+')','text-anchor':'middle','font-size':14},yLabel));
    return {x,y};
  }
  function draw() {
    $('motion-phase').setAttribute('aria-pressed',String(view==='phase'));$('motion-traces').setAttribute('aria-pressed',String(view==='traces'));
    if(!study)return;
    const available=study.results.map((r,i)=>({...r,color:palette[i%palette.length]})).filter(r=>r.refined);
    if(!available.length){$('motion-plot').replaceChildren(node('p','No complete trajectory is available. Inspect the retained failures below.',{class:'motion-empty'}));return;}
    const compact=root.getBoundingClientRect().width<760,W=compact?420:800,H=view==='phase'?430:600;
    const stage=svg('svg',{viewBox:'0 0 '+W+' '+H,role:'presentation'});
    function pathFor(rows,x,y,coordinates,color,status) {
      stage.append(svg('path',{d:rows.map((row,i)=>{const [a,b]=coordinates(row);return(i?'L':'M')+x(a)+' '+y(b);}).join(' '),fill:'none',stroke:color,'stroke-width':2.7,'stroke-dasharray':status==='step_sensitive'?'6 5':'','data-motion-path':status}));
      const [a,b]=coordinates(rows[frame]);stage.append(svg('circle',{cx:x(a),cy:y(b),r:5,fill:color,stroke:'#101c2d','stroke-width':2,'data-motion-dot':'true'}));
    }
    if(view==='phase') {
      const values=available.flatMap(r=>r.refined.rows.map(row=>row.position));
      let minX=Math.min(...values.map(q=>q[0])),maxX=Math.max(...values.map(q=>q[0])),minY=Math.min(...values.map(q=>q[1])),maxY=Math.max(...values.map(q=>q[1]));
      const padx=Math.max(.03,(maxX-minX)*.08),pady=Math.max(.03,(maxY-minY)*.08);
      const mapping=axes(stage,{left:compact?88:85,top:30,width:W-(compact?115:125),height:325,minX:minX-padx,maxX:maxX+padx,minY:minY-pady,maxY:maxY+pady,xLabel:'Angle 1 · rad',yLabel:'Angle 2 · rad'});
      for(const r of available)pathFor(r.refined.rows,mapping.x,mapping.y,row=>row.position,r.color,r.status);
    } else {
      for(let axis=0;axis<2;axis++) {
        const values=available.flatMap(r=>r.refined.rows.map(row=>row.position[axis])),min=Math.min(...values),max=Math.max(...values),pad=Math.max(.03,(max-min)*.08);
        const mapping=axes(stage,{left:compact?88:85,top:30+axis*290,width:W-(compact?115:125),height:210,minX:0,maxX:study.inputs.duration,minY:min-pad,maxY:max+pad,xLabel:'Time · s',yLabel:'Angle '+(axis+1)+' · rad'});
        for(const r of available)pathFor(r.refined.rows,mapping.x,mapping.y,row=>[row.time,row.position[axis]],r.color,r.status);
      }
    }
    $('motion-plot').replaceChildren(stage);
    const t=available[0].refined.rows[frame].time;$('motion-time').textContent=fmt(t)+' s';
    $('motion-plot-note').textContent=(view==='phase'?'Each path is the two predicted angles together.':'Each trace is one predicted angle over time.')+' Dots share the inspected time; line segments join retained output samples. Dashed paths did not meet the step-comparison tolerances. '+(reduce.matches?'Reduced motion is enabled; inspect with the time slider.':'Playback moves only through computed samples.');
  }
  function render() {
    stop();frame=0;$('motion-frame').value='0';$('motion-frame').max=String(study.inputs.samples-1);
    const available=study.results.filter(r=>r.refined),screened=study.results.filter(r=>r.status==='screened').length,failed=study.results.filter(r=>r.status==='failed').length;
    $('motion-frame').disabled=!available.length;$('motion-play').disabled=!available.length||reduce.matches;
    $('motion-status').textContent=screened+' met both step tolerances; '+(available.length-screened)+' remain step-sensitive; '+failed+' failed. '+(study.trainingStatus==='residual_mismatch'?'The fitted response family already has substantial training mismatch. ':'')+'Source: '+study.source.label+'. These are conditional simulations, not measured motion.'+([MATRIX_INPUT_SCHEMA,LOSS_INPUT_SCHEMA].includes(study.inputs.schema)?' Declared cross inertia '+fmt(study.inputs.inertiaCross)+' kg·m² is included in every acceleration solve.':'')+(study.inputs.schema===LOSS_INPUT_SCHEMA?' Symmetric cross loss '+fmt(study.inputs.dampingCross)+' N·m·s/rad is applied to the other coordinate’s velocity.':'');
    $('motion-rows').replaceChildren();$('motion-legend').replaceChildren();
    study.results.forEach((r,i)=>{
      const title=r.label+(r.modelId===study.selectedModelId?' · ranked first on training':'');
      const row=node('tr',undefined,{'data-model-id':r.modelId,'data-motion-status':r.status});
      const domain=r.refined?.domainStatus,range=domain==='outside_observed_range'?'Leaves observed range; first evaluated departure '+fmt(r.refined.firstOutside.time)+' s':domain==='evaluated_states_within_observed_range'?'Evaluated states within range':domain==='observed_range_unavailable'?'Range unavailable':'No completed refined path';
      row.append(node('td',title),node('td',r.status==='screened'?'Met both tolerances':r.status==='step_sensitive'?'Step-sensitive':r.failure.stage+' failed: '+r.failure.message),
        node('td',r.screen?fmt(Math.max(...r.screen.maxPositionDifference))+' rad':'—'),node('td',r.screen?fmt(Math.max(...r.screen.maxRateDifference))+' rad/s':'—'),node('td',range));
      $('motion-rows').append(row);
      if(r.refined){const span=node('span'),mark=node('i');mark.style.background=palette[i%palette.length];span.append(mark,node('span',r.label+(r.status==='step_sensitive'?' · step-sensitive':'')));$('motion-legend').append(span);}
    });
    for(const r of study.refusedModels??[]){const row=node('tr');row.append(node('td',r.label),node('td','Response fit unavailable: '+r.reason),node('td','—'),node('td','—'),node('td','No executable model'));$('motion-rows').append(row);}
    $('motion-results').hidden=false;appendModeInspection($('motion-modes'),retainedEvidence,study);draw();
  }
  function run() {invalidate('Computing the declared comparison…');try{const evidence=structuredClone(getNotebook());study=createCoupledDynamicsStudy(evidence,inputs());retainedEvidence=evidence;clearError();render();}catch(err){invalidate('No current dynamic comparison. Correct the inputs and run again.');error(err);}}
  $('motion-form').addEventListener('submit',event=>{event.preventDefault();run();});
  $('motion-form').addEventListener('input',event=>{
    if(['motion-inertia-kind','motion-loss-kind'].includes(event.target.id)){
      const declaration=$('motion-declaration').value;
      if([defaultDynamicsInputs().declaration,matrixDeclaration,lossDeclaration].includes(declaration))$('motion-declaration').value=$('motion-loss-kind').value==='symmetric'?lossDeclaration:$('motion-inertia-kind').value==='symmetric'?matrixDeclaration:defaultDynamicsInputs().declaration;
      syncInertiaControls();
    }
    generation++;invalidate('Inputs changed. Compare again to see current predictions.');clearError();});
  for(const [id,next]of [['motion-phase','phase'],['motion-traces','traces']])$(id).addEventListener('click',()=>{view=next;draw();});
  $('motion-frame').addEventListener('input',()=>{stop();frame=Number($('motion-frame').value);draw();});
  function tick(stamp) {
    if(!playing||!study)return;
    if(previousStamp===null)previousStamp=stamp;
    const advance=(stamp-previousStamp)/1000*(study.inputs.samples-1)/study.inputs.duration;
    if(advance>=1){const steps=Math.floor(advance);frame=Math.min(study.inputs.samples-1,frame+steps);previousStamp+=steps*1000*study.inputs.duration/(study.inputs.samples-1);$('motion-frame').value=String(frame);draw();}
    if(frame>=study.inputs.samples-1){stop();return;}raf=requestAnimationFrame(tick);
  }
  $('motion-play').addEventListener('click',()=>{if(playing){stop();return;}if(!study||reduce.matches)return;if(frame>=study.inputs.samples-1)frame=0;playing=true;$('motion-play').textContent='Pause';raf=requestAnimationFrame(tick);});
  reduce.addEventListener('change',()=>{stop();if(study){$('motion-play').disabled=reduce.matches||!study.results.some(r=>r.refined);draw();}});
  $('motion-save').addEventListener('click',()=>{try{
    const contents=exportDynamicsNotebook(getNotebook(),inputs()),url=URL.createObjectURL(new Blob([contents],{type:'application/json'})),link=node('a',undefined,{href:url,download:'worldlaw-coupled-motion.json'});
    link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);clearError();
  }catch(err){error(err);}});
  $('motion-open').addEventListener('click',()=>$('motion-file').click());
  $('motion-file').addEventListener('change',async()=>{
    const file=$('motion-file').files?.[0];$('motion-file').value='';if(!file)return;const ticket=++generation;
    try{
      if(file.size>3*1024*1024)throw new Error('Motion notebook exceeds 3 MB.');
      const contents=await file.text();if(ticket!==generation)return;
      const parsed=readDynamicsNotebook(contents),next=createCoupledDynamicsStudy(parsed.evidence,parsed.inputs);if(ticket!==generation)return;
      loadNotebook(parsed.evidence);setInputs(parsed.inputs,true);study=next;retainedEvidence=parsed.evidence;clearError();render();
    }catch(err){if(ticket===generation)error(err);}
  });
  let resize;
  window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(draw);});
  setInputs(defaultDynamicsInputs());
  const identification=mountInertiaIdentification($('motion-inertia-identification'),{getNotebook,applyRelease(input,label){
    generation++;setInputs(readDynamicsInputs(input),false);
    $('motion-declaration').value=('Proposed permitted release with '+label+'. '+input.declaration).slice(0,1000);
    invalidate('Proposed release and chosen fitted loss copied. Review and declare this motion experiment before comparing.');clearError();$('motion-position-0').focus();
  },applyParameters(parameters,label){
    generation++;$('motion-inertia-kind').value='symmetric';
    for(let axis=0;axis<2;axis++){$('motion-inertia-'+axis).value=parameters.inertia[axis];$('motion-damping-'+axis).value=parameters.damping[axis];}
    $('motion-inertia-cross').value=parameters.inertiaCross;
    const loss=Object.hasOwn(parameters,'dampingCross');$('motion-loss-kind').value=loss?'symmetric':'diagonal';$('motion-damping-cross').value=parameters.dampingCross??0;syncInertiaControls();
    $('motion-declaration').value=('Candidate weak-balance fit from '+label+'. Constant symmetric inertia and '+(loss?'symmetric':'diagonal')+' viscous loss; source pairing and physical validity remain declared assumptions.').slice(0,1000);
    $('motion-declared').checked=false;invalidate('Candidate inertia and damping copied. Review the source pairing and declare this experiment before comparing motion.');clearError();$('motion-inertia-0').focus();
  }});
  return {sourceChanged(){generation++;identification.contextChanged();$('motion-declared').checked=false;invalidate('Evidence changed. Declare the dynamic interpretation and compare the current fitted responses.');clearError();}};
}

