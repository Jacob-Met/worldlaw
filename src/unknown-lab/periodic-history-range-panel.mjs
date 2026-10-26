import {boundPeriodicHistory,HISTORY_RANGE_SCHEMA} from './periodic-history-range.mjs';

export function mountPeriodicHistoryRange(getCourse){
 const root=document.createElement('section');root.id='periodic-history-range';root.className='periodic-investigation';
 root.innerHTML=`<h2>How much preparation offset remains possible?</h2>
 <p>One compatible parameter vector is not an identified effect. Bound the offsets compatible with the same complete pair course, fixed-period sensor family and declared error limits.</p>
 <div class="periodic-workbench"><div class="periodic-controls">
 <label>Desired offset bracket width (N·m)<input id="range-resolution" type="number" min="0.00000001" max="1000" step="any" value="0.001"></label>
 <label>Maximum fixed-offset queries<input id="range-queries" type="number" min="0" max="64" step="1" value="32"></label>
 <label>Global estimated iterative matrix terms<input id="range-products" type="number" min="0" max="67108864" step="1" value="16777216"></label>
 <p>The global budget includes the initial witness search and every fixed-offset search. Input admission, QR/rank checks and final source checks are separate bounded work. The parent course's per-query limits also apply.</p>
 <button id="range-run" type="button">Bound compatible preparation offsets</button>
 <button id="range-save" type="button" disabled>Save source and range settings</button>
 <label>Reopen range inputs<input id="range-open" type="file" accept="application/json"></label>
 <p id="range-status" role="status" aria-live="polite">Check the complete pair course above first.</p></div><div id="range-result"></div></div>`;
 document.getElementById('periodic-course').after(root);
 const $=id=>root.querySelector('#'+id),status=$('range-status'),out=$('range-result'),save=$('range-save');let generation=0,retained=null,independentCourse=null;
 const fmt=x=>Number(x).toFixed(Math.max(2,Math.min(10,Math.ceil(-Math.log10(retained?.settings.resolution??.001))+2))),span=values=>'['+values.map(fmt).join(', ')+'] N·m';
 function clearResult(message='Range settings changed; bound the offsets again.'){
  generation++;retained=null;save.disabled=true;out.replaceChildren();status.textContent=message;delete status.dataset.status;
 }
 function invalidate(message='Source or declarations changed; reopen a snapshot or check the complete pair course again.'){
  independentCourse=null;clearResult(message);
 }
 for(const id of ['range-resolution','range-queries','range-products'])$(id).oninput=()=>clearResult();
 const numeric=id=>{if(!$(id).value.trim())throw Error('Declare every range setting explicitly.');return Number($(id).value);};
 const labels={bracketed:'Conditional offset range bracketed','incompatible-course':'No compatible offset in this declared model','unresolved-initial-search':'No compatible point established within this search','unresolved-boundary':'Partially bounded; uncertainty remains'};
 function display(raw,note){
  const r=boundPeriodicHistory(raw);retained=r.inputs;save.disabled=false;out.replaceChildren();status.dataset.status=r.status;
  status.textContent=note+' · '+labels[r.status]+'. '+r.inputs.course.discrepancyBasis;
  const p=text=>{const e=document.createElement('p');e.textContent=text;out.append(e);};
  p('Declared prior: '+span(r.prior)+'. '+(r.priorFixed?'The prior fixes the offset; this value was declared, not learned.':'Offsets outside this prior were never offered.'));
  if(r.inner){p('Witness-supported inner interval: '+span(r.inner));p('Conservative outer bracket: '+span(r.outer));}
  else p(r.status==='incompatible-course'?'The complete course rejects every offset in the offered family; no interval is invented.':'Only the declared prior is retained. No compatible point or narrower range is claimed.');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 600 190');svg.setAttribute('role','img');svg.setAttribute('aria-label','Declared prior, witnessed inner interval and outer offset bracket');
  const extent=Math.max(.001,r.inputs.course.historyBound)*1.1,X=v=>30+(v+extent)/(2*extent)*540;
  const line=(values,y,color,width)=>{const l=document.createElementNS(svg.namespaceURI,'line');for(const [k,v]of Object.entries({x1:X(values[0]),x2:X(values[1]),y1:y,y2:y,stroke:color,'stroke-width':width}))l.setAttribute(k,String(v));svg.append(l);};
  const label=(text,y)=>{const t=document.createElementNS(svg.namespaceURI,'text');t.setAttribute('x','15');t.setAttribute('y',String(y));t.setAttribute('fill','#a8c0c4');t.setAttribute('font-size','14');t.textContent=text;svg.append(t);};
  label('DECLARED PRIOR',22);line(r.prior,38,'#728b98',6);
  if(r.outer){label(r.inner?'OUTER BRACKET':'PRIOR ONLY · NO POINT ESTABLISHED',79);line(r.outer,95,'#bb6bd9',10);}
  if(r.inner){label('WITNESS-SUPPORTED INNER INTERVAL',136);line(r.inner,152,'#5df5df',8);if(r.inner[0]===r.inner[1]){const c=document.createElementNS(svg.namespaceURI,'circle');c.setAttribute('cx',String(X(r.inner[0])));c.setAttribute('cy','152');c.setAttribute('r','5');c.setAttribute('fill','#5df5df');svg.append(c);}}
  const zero=document.createElementNS(svg.namespaceURI,'line');for(const [k,v]of Object.entries({x1:X(0),x2:X(0),y1:28,y2:170,stroke:'#ffad5c','stroke-width':1,'stroke-dasharray':'3 4'}))zero.setAttribute(k,String(v));svg.append(zero);out.append(svg);
  p('Amber reference: zero. These are conditional compatibility bounds, not confidence intervals or proof of a physical preparation effect.');
  const stopLabels={'requested-offset-resolution':'Requested bracket width reached.','global-matrix-budget':'Global search budget exhausted; wider bounds retained.','fixed-query-budget':'Fixed-offset query limit reached; wider bounds retained.','unresolved-fixed-offset-search':'A fixed-offset search remains unresolved; wider bounds retained.','zero-scale':'The zero-scale model remains unresolved at the numerical boundary; no compatible point or exclusion is claimed.','iteration-budget':'Initial witness search reached its iteration limit.','product-budget':'Initial witness search reached its matrix-work limit.'};
  p(`${r.queries.length} fixed-offset queries; ${r.products} estimated iterative matrix terms across all searches. `+(stopLabels[r.stoppingReason??r.initial.reason]??(r.status==='incompatible-course'?'The original course has a checked contradiction.':'The initial search remains unresolved; no compatible point or exclusion is claimed.')));
  for(const side of r.sides)if(side.reason==='prior-bound-compatible')p((side.side==='lower'?'Lower':'Upper')+' edge is limited by the declared prior.');
  if(r.sides.length){
   const sides=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Inspect named endpoint parameters and excluded-offset evidence';sides.append(summary);
   const origin=Math.min(...r.inputs.course.evidence.notebook.trials.map(t=>t.sampleIndex));
   const named=certificate=>{
    const v=certificate.values;return {historyOffsetNm:v[0],linearDriftNmPerAcquisitionStep:v[1],phaseOriginAcquisitionIndex:origin,periodicComponents:r.inputs.course.evidence.components.map((c,k)=>({periodAcquisitionSteps:c.period,cosineCoefficientNm:v[2+2*k],sineCoefficientNm:v[3+2*k],amplitudeNm:Math.hypot(v[2+2*k],v[3+2*k]),amplitudeBoundNm:c.amplitudeBound}))};
   };
   const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';
   pre.textContent=JSON.stringify(r.sides.map(s=>({side:s.side,innerOffsetNm:s.inner,outerOffsetNm:s.outer,reason:s.reason??null,witness:named(s.witness.certificate),witnessCheck:s.witness.check,...(s.separator?{excludedOffsetSupport:s.separator.check}:{})})),null,2);sides.append(pre);out.append(sides);
   p('Named vectors are constructed endpoint witnesses, not uniquely estimated coefficients. Every between-endpoint convex combination remains inside the declared boxes/disks and pair-discrepancy strips. An excluded offset and a compatible point on the opposite side justify the corresponding outer exclusion.');
  }
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Inspect every fixed-offset query';details.append(summary);
  const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=JSON.stringify(r.queries.map(q=>({side:q.side,offsetNm:q.offset,status:q.status,reason:q.reason??null,search:q.search,iterations:q.iterations,matrixTerms:q.products,gap:q.check?.gap,numericalTolerance:q.check?.numericalTolerance})),null,2);details.append(pre);out.append(details);
  p(r.qualification);
 }
 $('range-run').onclick=()=>{clearResult();try{display({schema:HISTORY_RANGE_SCHEMA,course:independentCourse??getCourse(),settings:{resolution:numeric('range-resolution'),maxQueries:numeric('range-queries'),maxProducts:numeric('range-products')}},independentCourse?'Recomputed reopened independent snapshot; parent inspectors are unchanged':'Checked parent course snapshot');}catch(e){status.textContent=e.message;}};
 save.onclick=()=>{if(!retained)return;const url=URL.createObjectURL(new Blob([JSON.stringify(retained,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-periodic-history-range.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
 $('range-open').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;invalidate();const token=generation;try{if(file.size>280000)throw Error('Use range input JSON under 280 KB.');const text=await file.text();if(token!==generation)return;display(JSON.parse(text),'Reopened independent snapshot; parent inspectors are unchanged');independentCourse=structuredClone(retained.course);$('range-resolution').value=retained.settings.resolution;$('range-queries').value=retained.settings.maxQueries;$('range-products').value=retained.settings.maxProducts;}catch(err){if(token===generation){retained=null;save.disabled=true;out.replaceChildren();status.textContent=err.message;delete status.dataset.status;}}finally{if(token===generation)e.target.value='';}};
 return {invalidate};
}
