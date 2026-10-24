import {comparePeriodicCourses,PERIODIC_COURSE_SCHEMA} from './periodic-course.mjs';

export function mountPeriodicCourse(getEvidence){
 const root=document.createElement('section');root.id='periodic-course';root.className='periodic-investigation';
 root.innerHTML=`<h2>Can one explanation account for every pair?</h2>
 <p>The average can conceal an impossible sensor explanation. Reuse the inspected periodic evidence above, then test one shared parameter vector against every original pair.</p>
 <details><summary>Two explicit families and their limits</summary><p>Both families allow the same bounded linear acquisition-index drift and common periodic components. One fixes preparation offset to zero; the other allows one constant offset shared by all pairs. A successful witness does not identify its coefficients. Failure rejects only these assumptions; a preparation-dependent response may vary with state, and other sensor processes remain possible.</p></details>
 <div class="periodic-workbench"><div class="periodic-controls">
 <label>Maximum absolute constant preparation offset (N·m)<input id="course-history" type="number" min="0" max="1000" step="any" value="0.5"></label>
 <label>Maximum absolute linear sensor drift (N·m / acquisition step)<input id="course-drift" type="number" min="0" max="1000" step="any" value="0.1"></label>
 <label>Absolute discrepancy allowed in each pair difference (N·m)<input id="course-radius" type="number" min="0" max="1000" step="any" value="0.01"></label>
 <label>Basis for these bounds and the constant-offset assumption<input id="course-basis" maxlength="2000" placeholder="Declare why these bounds apply to this course"></label>
 <p>The pair bound is separately declared. It is not inferred from noise sigma or the history screen; it must cover all admitted unexplained pair differences, including any current-state mismatch.</p>
 <label>Search iterations per family<input id="course-iterations" type="number" min="0" max="4096" step="1" value="1024"></label>
 <button id="course-run" type="button">Check every pair</button>
 <button id="course-save" type="button" disabled>Save source and model bounds</button>
 <label>Reopen course inputs<input id="course-open" type="file" accept="application/json"></label>
 <p id="course-status" role="status" aria-live="polite">Inspect periodic evidence above first.</p></div><div id="course-result"></div></div>`;
 document.getElementById('periodic-contrast').after(root);
 const $=id=>root.querySelector('#'+id),out=$('course-result'),status=$('course-status'),save=$('course-save');let generation=0,retained=null;
 const fmt=n=>Number(n).toPrecision(6);
 function invalidate(message='Source or declarations changed; check the course again.'){
  generation++;retained=null;out.replaceChildren();save.disabled=true;status.textContent=message;
 }
 for(const id of ['course-history','course-drift','course-radius','course-basis','course-iterations'])$(id).oninput=()=>invalidate();
 const numeric=id=>{if(!$(id).value.trim())throw Error('Declare every numerical bound explicitly.');return Number($(id).value);};
 function receive(raw,label){
  const result=comparePeriodicCourses(raw);retained=result.inputs;save.disabled=false;out.replaceChildren();
  status.textContent=label+' · '+result.inputs.evidence.notebook.source+' · '+result.inputs.discrepancyBasis;
  const p=(host,text)=>{const el=document.createElement('p');el.textContent=text;host.append(el);};
  p(out,'Aggregate inspection: '+result.aggregate.status+'. The complete pair pattern is checked separately below.');
  for(const [name,course] of [['Zero preparation offset',result.zero],['Bounded constant preparation offset',result.constant]]){
   const box=document.createElement('article');box.className='course-family';box.dataset.status=course.status;box.dataset.reason=course.reason??'';const h=document.createElement('h3');h.textContent=name;box.append(h);
   const labels={'verified-course-witness':'One compatible parameter set found','verified-course-separation':'Declared explanation rejected',unresolved:'Unresolved within this search'};
   const reasons={'iteration-budget':'iteration limit reached','product-budget':'estimated matrix-work limit reached','zero-scale':'no available search direction'};
   p(box,labels[course.status]+(course.reason?' · '+(reasons[course.reason]??'numerical boundary remains unresolved'):''));
   p(box,`Active-column rank ${course.rank}/${course.activeColumns}; ${course.iterations} search iterations; ${course.products} estimated iterative matrix terms. Rank and a compatible witness never establish parameter uniqueness.`);
   if(course.check?.gap!==undefined)p(box,`Weighted original differences ${fmt(course.check.discrepancy)} N·m exceed maximum declared support ${fmt(course.check.support)} N·m by ${fmt(course.check.gap)} N·m. Numerical tolerance ${fmt(course.check.numericalTolerance)} N·m.`);
   if(course.check?.rows){
    p(box,`One common bounded parameter vector receives all ${course.check.rows.length} pairs strictly inside their declared discrepancy bands. Maximum absolute residual ${fmt(Math.max(...course.check.rows.map(r=>Math.abs(r.residual))))} N·m.`);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 600 250');svg.setAttribute('role','img');svg.setAttribute('aria-label',name+': original pair differences versus one constructed compatible witness');
    const rows=course.check.rows,min=Math.min(...rows.flatMap(r=>[r.observed,r.prediction-retained.pairRadius])),max=Math.max(...rows.flatMap(r=>[r.observed,r.prediction+retained.pairRadius]));
    const scale=Math.max(max-min,.02),y=v=>220-180*(v-min)/scale;
    for(let i=0;i<rows.length;i++){
     const row=rows[i],x=30+540*i/Math.max(1,rows.length-1);
     const line=document.createElementNS(svg.namespaceURI,'line');for(const [k,v]of Object.entries({x1:x,x2:x,y1:y(row.prediction-retained.pairRadius),y2:y(row.prediction+retained.pairRadius),stroke:'#ffad5c','stroke-width':3}))line.setAttribute(k,String(v));svg.append(line);
     const dot=document.createElementNS(svg.namespaceURI,'circle');for(const [k,v]of Object.entries({cx:x,cy:y(row.observed),r:3,fill:'#5df5df'}))dot.setAttribute(k,String(v));svg.append(dot);
    }
    box.append(svg);p(box,'Cyan: original pair differences, in original pair order. Amber: discrepancy band around one constructed compatible response. This is an existence witness, not a fitted or uniquely identified physical law. Exact values follow.');
   }
   if(course.certificate){
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Inspect every original pair and the numerical certificate';details.append(summary);
    const pre=document.createElement('pre');pre.textContent=JSON.stringify({kind:course.certificate.kind,parametersOrWeights:course.certificate.values,check:course.check,originalPairs:course.aggregate.original.pairs.map(p=>({id:p.id,referenceIndex:p.reference.sampleIndex,conditionedIndex:p.conditioned.sampleIndex,difference:p.difference}))},null,2);pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';details.append(pre);box.append(details);
   }
   out.append(box);
  }
  p(out,result.interpretation);p(out,'Iteration and matrix-term limits bound the search, excluding bounded input admission, QR/rank diagnostics and final independent raw-source checks. No pair or periodic component is dropped on exhaustion; unresolved is retained. The engineering roundoff screen is not certified interval arithmetic.');
 }
 $('course-run').onclick=()=>{invalidate();try{receive({schema:PERIODIC_COURSE_SCHEMA,boundUnits:{history:'N*m',drift:'N*m/acquisition_step',pair:'N*m'},evidence:getEvidence(),historyBound:numeric('course-history'),driftBound:numeric('course-drift'),pairRadius:numeric('course-radius'),discrepancyBasis:$('course-basis').value,search:{maxIterations:numeric('course-iterations'),maxProducts:16777216}},'Checked inspected snapshot');}catch(e){status.textContent=e.message;}};
 save.onclick=()=>{if(!retained)return;const url=URL.createObjectURL(new Blob([JSON.stringify(retained,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-periodic-course.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
 $('course-open').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;invalidate();const token=generation;try{if(file.size>260000)throw Error('Use course JSON under 260 KB.');const text=await file.text();if(token!==generation)return;receive(JSON.parse(text),'Reopened course snapshot; original inspectors are unchanged');$('course-history').value=retained.historyBound;$('course-drift').value=retained.driftBound;$('course-radius').value=retained.pairRadius;$('course-basis').value=retained.discrepancyBasis;$('course-iterations').value=retained.search.maxIterations;}catch(err){if(token===generation){retained=null;save.disabled=true;out.replaceChildren();status.textContent=err.message;}}finally{if(token===generation)e.target.value='';}};
 return {invalidate};
}
