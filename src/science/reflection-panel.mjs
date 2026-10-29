import {reflectionSlices,analyzeReflectionCompatibility,reflectionDisplayBounds} from './reflection-compatibility.mjs';

const mountedCleanup=new WeakMap();
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const svg=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))n.setAttribute(key,String(value));if(text!==undefined)n.textContent=text;return n;};
const number=n=>Number(n.toPrecision(7)).toString();
const rational=q=>`${q.numerator}/${q.denominator}`;
const enclosure=q=>{const b=reflectionDisplayBounds(q);return b.lower===b.upper?number(b.lower):`[${number(b.lower)}, ${number(b.upper)}]`;};
const label=(text,input)=>{const n=el('label',text);n.append(input);return n;};
const opt=(value,text)=>{const n=el('option',text);n.value=String(value);return n;};
function paged(parent,total,name,render,size=25){let page=0;const pages=Math.max(1,Math.ceil(total/size));const controls=el('div',undefined,'reflection-pagination');controls.dataset.pagination=name;const description=el('p');const previous=el('button','Previous page'),next=el('button','Next page');previous.type=next.type='button';previous.dataset.pageDirection='previous';next.dataset.pageDirection='next';controls.append(description);if(pages>1)controls.append(previous,next);parent.append(controls);function update(){const start=page*size,end=Math.min(total,start+size);description.textContent=`${name}: ${total?start+1:0}–${end} of ${total}. All entries remain available.`;previous.disabled=page===0;next.disabled=page===pages-1;render(start,end);}previous.addEventListener('click',()=>{if(page>0){page--;update();}});next.addEventListener('click',()=>{if(page<pages-1){page++;update();}});update();}
function exact(parent,title,entries){const details=el('details',undefined,'reflection-exact-values');details.append(el('summary',title));for(const [name,q]of entries){const p=el('p',`${name}: `);p.append(el('code',rational(q)));details.append(p);}parent.append(details);}
function intervalText(parent,title,interval){parent.append(el('p',`${title}: lower ${enclosure(interval.lower)}; upper ${enclosure(interval.upper)} N·m (rounded display).`));exact(parent,'Exact rational endpoints',[['Lower',interval.lower],['Upper',interval.upper]]);}

/** Source-only companion instrument. Re-rendering resets every declaration. */
export function renderReflectionCompatibility(container,observations,source){
 mountedCleanup.get(container)?.();let resizeObserver=null;mountedCleanup.set(container,()=>resizeObserver?.disconnect());
 container.replaceChildren();container.className='reflection-instrument';
 const details=el('details');details.append(el('summary','Challenge odd angle response'));container.append(details);
 details.append(el('p','Can one shared offset explain opposite-angle torque readings? Inspect τ(θ) = c + g(θ), with g(−θ) = −g(θ), using original readings at one exact command and rate.','reflection-thesis'));
 details.append(el('p',`${source?.label??'Original notebook'} · ${source?.kind??'Unspecified source'}${source?.declaredKind?` (${source.declaredKind})`:''}. Original fitting rows only; no fitted torque or held-out rows enter this screen.`,'reflection-source'));
 const controls=el('div',undefined,'reflection-controls');
 const slice=el('select');slice.id='reflection-slice';const radius=el('input');radius.id='reflection-radius';radius.type='number';radius.min='0';radius.max='1000000';radius.step='any';radius.placeholder='Declare a bound';const assumed=el('input');assumed.type='checkbox';assumed.id='reflection-exact';
 const run=el('button','Inspect shared offset');run.type='button';run.id='reflection-run';run.className='button button-outline';
 controls.append(label('Exact command / rate slice',slice),label('Absolute error of each torque reading (N·m)',radius),label('Assume the declared input coordinates are exact',assumed),run);details.append(controls,el('p','Angle origin is fixed at 0 rad. The absolute reading bound is your declaration, not a fitted noise standard deviation or a row noise ratio. No near-angle matching, fitting, calibration or interpolation is performed.'));
 const output=el('div');output.id='reflection-output';details.append(output);const status=el('p');status.id='reflection-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');output.append(status);
 let slices;
  try{slices=reflectionSlices(observations);slices.forEach((s,i)=>slice.append(opt(i,`command ${s.command} N·m · rate ${s.rate} rad/s · ${s.rowIndices.length} rows`)));if(!slices.length){run.disabled=true;status.textContent='No original rows are available for a command/rate slice.';}else status.textContent='Declare an absolute torque-reading bound and explicitly assume exact input coordinates, then inspect the shared offset.';}
 catch(error){run.disabled=true;status.textContent=`Screen refused: ${error.message}`;return;}
 function clear(){resizeObserver?.disconnect();resizeObserver=null;output.replaceChildren(status);delete output.dataset.status;status.textContent='Declarations changed. Inspect the shared offset again.';}
 slice.addEventListener('change',clear);radius.addEventListener('input',clear);assumed.addEventListener('change',clear);
 run.addEventListener('click',()=>{clear();try{const selected=slices[Number(slice.value)];const result=analyzeReflectionCompatibility(observations,{command:selected?.command,rate:selected?.rate,absoluteTorqueError:radius.value.trim()===''?undefined:Number(radius.value),exactCoordinates:assumed.checked});show(result);}catch(error){output.replaceChildren(status);output.dataset.status='refused';status.textContent=`Screen refused: ${error.message}`;}});

 function show(result){
  output.dataset.status=result.status;
  if(result.status==='declaration-required'){const names={command:'an exact command',rate:'an exact rate',absoluteTorqueError:'an absolute torque-reading bound',exactCoordinates:'the explicit exact-coordinate assumption'};status.textContent=`Declarations required: ${result.missing.map(key=>names[key]??'a required declaration').join('; ')}. No scientific conclusion calculated.`;return;}
  const titles={'repeat-conflict':'Repeated readings conflict under the declared bound','insufficient':'Insufficient mirrored source evidence','excluded':'No shared offset satisfies these original readings','compatible':'One shared offset is compatible with these finite readings'};
  status.textContent=titles[result.status]??result.status;
  const coverage=result.coverage;output.append(el('p',`${coverage.selectedRows} of ${result.sourceRowCount} original rows in this slice · ${coverage.mirroredPairs} exact nonzero angle pairs · ${coverage.zeroRows} zero-angle rows · ${coverage.unmatchedRows} unmatched rows.`));
  output.append(el('p','Compatibility concerns only these finite readings and the declared bounds. It does not identify a continuous odd law, calibrate an instrument, or establish physical validity. Conflicting repeats are a separate deterministic-response/bound problem, not an oddness exclusion.','reflection-limit'));
  if(result.status==='insufficient')output.append(el('p',result.reason==='no-selected-rows'?'No original rows share this exact command and rate.':'No nonzero ±angle pair exists. A zero-angle anchor may constrain c, but cannot establish reflection coverage.'));
  if(result.commonOffset)intervalText(output,result.status==='excluded'?'Contradictory offset limits (lower exceeds upper)':'Shared offset limits',result.commonOffset);
  if(result.certificate?.gap)exact(output,'Exact contradiction gap',[['Positive gap (N·m)',result.certificate.gap]]);
  if(result.certificate?.kind==='finite-witness'){
   const witness=el('details');witness.append(el('summary','Inspect finite mathematical witness — not fitted observations'));
   witness.append(el('p','These exact torque assignments satisfy the declared finite constraints. They are not new measurements, a calibration, or a fitted curve.'));
   exact(witness,'Exact witness offset',[['c (N·m)',result.certificate.offset]]);
   const assignments=el('div');witness.append(assignments);paged(witness,result.certificate.stateTorques.length,'Witness assignments',(start,end)=>{assignments.replaceChildren();for(const item of result.certificate.stateTorques.slice(start,end)){const p=el('p',`θ = ${result.states[item.stateIndex].position} rad · assigned τ: `);p.append(el('code',rational(item.torque)));assignments.append(p);}});output.append(witness);
  }
  const tools=el('div',undefined,'reflection-view-controls');const composition=el('select');composition.id='reflection-composition';composition.append(opt('intervals','Shared-offset intervals'),opt('mirrored','Mirrored original readings'));const constraint=el('select');constraint.id='reflection-constraint';for(const c of result.constraints)constraint.append(opt(c.id,c.kind==='zero'?'Zero-angle anchor':`Original pair −${c.magnitude}, +${c.magnitude} rad`));
  tools.append(label('Inspection view',composition),label('Source constraint',constraint));constraint.disabled=!result.constraints.length;
  const contradiction=el('button','Inspect contradiction witnesses');contradiction.type='button';contradiction.id='reflection-contradiction';contradiction.className='button button-outline';contradiction.hidden=!['offset-exclusion','repeat-conflict'].includes(result.certificate?.kind);tools.append(contradiction);output.append(tools);
  const graphic=el('div');graphic.id='reflection-graphic';graphic.tabIndex=0;graphic.setAttribute('role','region');graphic.setAttribute('aria-label','Source constraint illustration with all displayed bounds visible');const plotControls=el('div');plotControls.id='reflection-plot-controls';const evidence=el('div');evidence.id='reflection-evidence';output.append(el('p','Graphics use outward binary64 enclosures and rounded labels; distinct exact endpoints may occupy the same pixel. Exact rational endpoints below remain authoritative. Original-row tables can be scrolled horizontally; plots fit the available width.','reflection-plot-note'),plotControls,graphic,evidence);
  let witnessMode=result.status==='repeat-conflict';
  function chosen(){if(witnessMode&&result.certificate?.kind==='offset-exclusion')return result.constraints.filter(c=>c.id===result.certificate.lowerConstraintId||c.id===result.certificate.upperConstraintId);return result.constraints.filter(c=>c.id===constraint.value);}
  function inspect(){
   graphic.replaceChildren();plotControls.replaceChildren();evidence.replaceChildren();evidence.dataset.witness=String(witnessMode);
   const selected=chosen();let stateIndices=[...new Set(selected.flatMap(c=>c.stateIndices))];if(witnessMode&&result.certificate?.kind==='repeat-conflict')stateIndices=[result.certificate.stateIndex];if(!stateIndices.length)stateIndices=result.states.map((_,i)=>i);
   if(composition.value==='intervals')drawIntervals(graphic,result,selected.map(c=>c.id),plotControls);else drawMirrored(graphic,result,stateIndices,selected,plotControls);
   for(const c of selected){const block=el('section');block.append(el('h4',c.kind==='zero'?'Zero-angle source anchor':`Pair at ±${c.magnitude} rad`));intervalText(block,'Allowable c',c.interval);evidence.append(block);}
   if(witnessMode&&result.certificate?.kind==='repeat-conflict'){const s=result.states[result.certificate.stateIndex];evidence.append(el('p',`Original rows ${result.certificate.lowerRowIndex+1} and ${result.certificate.upperRowIndex+1} contradict at θ = ${s.position} rad. No offset constraints were calculated.`));}
   if(witnessMode&&result.certificate?.kind==='offset-exclusion')evidence.append(el('p',`Lower bound witness: ${result.certificate.lowerConstraintId}. Upper bound witness: ${result.certificate.upperConstraintId}. Both constraints and every contributing original row are shown.`));
   sourceTable(evidence,result,stateIndices);
  }
  constraint.addEventListener('change',()=>{witnessMode=false;inspect();});composition.addEventListener('change',inspect);contradiction.addEventListener('click',()=>{witnessMode=true;if(result.certificate.kind==='offset-exclusion')constraint.value=result.certificate.lowerConstraintId;inspect();evidence.tabIndex=-1;evidence.focus({preventScroll:true});evidence.scrollIntoView({behavior:'instant',block:'start'});});inspect();let lastWidth=graphic.clientWidth;resizeObserver=new ResizeObserver(()=>{if(graphic.clientWidth!==lastWidth){lastWidth=graphic.clientWidth;inspect();}});resizeObserver.observe(graphic);
  const all=el('details');all.append(el('summary','Inspect every original row in the selected slice, including unmatched angles'));sourceTable(all,result,result.states.map((_,i)=>i),false);output.append(all);
  output.append(el('p','The original Studio notebook remains unchanged. Save/reopen the original notebook using the Studio controls; redeclare this screen’s assumptions afterward.'));
 }

 function sourceTable(parent,result,stateIndices,primary=true){
  const section=el('section');section.dataset.sourceTable=primary?'selected':'all';parent.append(section);const intersections=el('div');section.append(intersections);
  const wrap=el('div',undefined,'reflection-table-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Original source rows and exact reading bounds');const table=el('table');if(primary)table.id='reflection-source-table';table.append(el('caption','Original readings — row numbers refer to the retained notebook'));
  const head=el('thead'),hr=el('tr');for(const text of ['Original row','Command (N·m)','Angle (rad)','Rate (rad/s)','Observed torque (N·m)','Declared reading bounds']){const th=el('th',text);th.scope='col';hr.append(th);}head.append(hr);table.append(head);const body=el('tbody');
  table.append(body);wrap.append(table);section.append(wrap);const entries=stateIndices.flatMap(i=>result.states[i].readingBounds.map(bound=>({stateIndex:i,bound}))).sort((a,b)=>a.bound.rowIndex-b.bound.rowIndex);
  paged(section,entries.length,'Original rows',(start,end)=>{body.replaceChildren();intersections.replaceChildren();const visible=entries.slice(start,end);for(const {bound}of visible){const row=observations[bound.rowIndex],tr=el('tr');tr.dataset.rowIndex=String(bound.rowIndex);const th=el('th',String(bound.rowIndex+1));th.scope='row';tr.append(th,...['command','position','rate','jointTorque'].map(k=>el('td',String(row[k]))));const cell=el('td',`${enclosure(bound.lower)} to ${enclosure(bound.upper)} N·m`);exact(cell,'Exact rational endpoints',[['Lower',bound.lower],['Upper',bound.upper]]);tr.append(cell);body.append(tr);}
   for(const i of new Set(visible.map(entry=>entry.stateIndex))){const state=result.states[i],detail=el('details');detail.append(el('summary',`Intersection at θ = ${state.position} rad · all ${state.rowIndices.length} original readings`));intervalText(detail,'State intersection',state.interval);intersections.append(detail);}
  });
 }
}

function scaleFor(values,left=130,right=570){const low=Math.min(...values),high=Math.max(...values);if(low===high)return {at:()=>((left+right)/2),low,high};return {at:x=>left+(x-low)/(high-low)*(right-left),low,high};}
function plotWidth(host){return Math.max(240,Math.min(620,host.clientWidth-16));}
function drawIntervals(host,result,selected,controls){
 if(!result.constraints.length){controls.append(el('p','No shared-offset lanes are available. Inspect original rows and repeat bounds below.'));return;}
 const width=plotWidth(host),left=100,right=width-18;
 const bounds=result.constraints.flatMap(c=>[reflectionDisplayBounds(c.interval.lower).lower,reflectionDisplayBounds(c.interval.upper).upper]);const scale=scaleFor(bounds,left,right);const pinned=result.constraints.filter(c=>selected.includes(c.id)),others=result.constraints.filter(c=>!selected.includes(c.id));
 controls.append(el('p',`${result.constraints.length} constraints computed. ${pinned.length} selected or contradiction-witness lanes stay pinned on every page. The scale and common limits use all constraints.`));
 paged(controls,others.length,'Other constraint lanes',(start,end)=>{const visible=[...pinned,...others.slice(start,end)],height=100+visible.length*42;const plot=svg('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':'Aligned allowable shared-offset intervals from original pairs and zero anchors'});plot.append(svg('title',{},'Every lane constrains the same c; exact endpoints and original rows are available below.'));plot.append(svg('text',{x:left,y:22},'Offset c (N·m)'));
 plot.append(svg('line',{x1:left,y1:42,x2:right,y2:42,class:'reflection-axis'}));plot.append(svg('text',{x:left,y:62},number(scale.low)),svg('text',{x:right,y:62,'text-anchor':'end'},number(scale.high)));
 if(result.commonOffset){for(const [key,cls]of [['lower','lower'],['upper','upper']]){const b=reflectionDisplayBounds(result.commonOffset[key]);const x=scale.at(key==='lower'?b.lower:b.upper);plot.append(svg('line',{x1:x,y1:72,x2:x,y2:height-10,class:`reflection-limit-line ${cls}`}));}}
 visible.forEach((c,i)=>{const y=90+i*42,lo=reflectionDisplayBounds(c.interval.lower).lower,hi=reflectionDisplayBounds(c.interval.upper).upper,x1=scale.at(lo),x2=scale.at(hi);plot.append(svg('text',{x:4,y:y+5,'font-size':12},c.kind==='zero'?'θ = 0':`±${number(c.magnitude)}`));plot.append(svg('line',{x1,y1:y,x2,y2:y,class:selected.includes(c.id)?'reflection-band selected':'reflection-band'}),svg('line',{x1,y1:y-7,x2:x1,y2:y+7,class:'reflection-cap'}),svg('line',{x1:x2,y1:y-7,x2,y2:y+7,class:'reflection-cap'}));for(const px of new Set([x1,x2]))plot.append(svg('circle',{cx:px,cy:y,r:4,class:selected.includes(c.id)?'reflection-endpoint selected':'reflection-endpoint'}));});
 host.replaceChildren(plot);},10);
 controls.append(el('p','Lane labels are original angle magnitudes in radians. Solid lanes constrain c; dots mark displayed endpoints, which may coincide after rounding. Dashed markers show common lower and upper limits. Exact ordering comes from the core, never pixel position.','reflection-plot-note'));
}
function drawMirrored(host,result,stateIndices,selected,controls){
 const states=stateIndices.map(i=>result.states[i]);if(!states.length){controls.append(el('p','No original readings in this slice.'));return;}
 const width=plotWidth(host),center=(70+width-20)/2,half=(width-90)/2;
 const values=states.flatMap(s=>s.readingBounds.flatMap(r=>[reflectionDisplayBounds(r.lower).lower,reflectionDisplayBounds(r.upper).upper]));const scale=scaleFor(values,285,60),maxAngle=Math.max(0,...states.map(s=>Math.abs(s.position)));const x=a=>maxAngle?center+a/maxAngle*half:center;
 const plot=svg('svg',{viewBox:`0 0 ${width} 365`,width,height:365,role:'img','aria-label':'Original torque readings at opposite declared angles; no fitted curve or interpolated readings'});plot.append(svg('title',{},'Original torque points with declared reading intervals at exact observed angles. Pair sums constrain twice the offset.'));plot.append(svg('line',{x1:center,y1:42,x2:center,y2:305,class:'reflection-axis'}),svg('line',{x1:70,y1:305,x2:width-20,y2:305,class:'reflection-axis'}),svg('text',{x:8,y:22},'Original τ (N·m)'),svg('text',{x:width/2,y:350,'text-anchor':'middle'},'θ (rad) · origin 0'));
 plot.append(svg('text',{x:8,y:65},number(scale.high)),svg('text',{x:8,y:290},number(scale.low)));
 for(const state of states){const px=x(state.position);plot.append(svg('text',{x:px,y:327,'text-anchor':'middle'},number(state.position)));for(const reading of state.readingBounds){const lo=reflectionDisplayBounds(reading.lower).lower,hi=reflectionDisplayBounds(reading.upper).upper;plot.append(svg('line',{x1:px,y1:scale.at(lo),x2:px,y2:scale.at(hi),class:'reflection-band'}),svg('circle',{cx:px,cy:scale.at(reading.observedTorque),r:4,class:'reflection-original'}));}}
 if(selected.some(c=>c.kind==='pair'))controls.append(el('p','The shared-offset hypothesis requires τ(−a) + τ(+a) = 2c for every matched pair.'));
 controls.append(el('p','Dots and vertical bounds are original readings, not predictions. Opposite angles are symmetric about the fixed origin. Overlapping repeats remain individually inspectable below. No curve or missing opposite reading is invented.','reflection-plot-note'));host.append(plot);
}
