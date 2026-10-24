import {inspectPeriodicContrast,PERIODIC_CONTRAST_SCHEMA} from './periodic-contrast.mjs';

export function mountPeriodicContrast(getNotebook){
 const root=document.createElement('section');root.id='periodic-contrast';root.className='periodic-investigation';
 root.innerHTML=`<h2>Could a periodic sensor offset explain this contrast?</h2>
 <p>Confront the observed contrast with a bounded sensor-offset explanation. The original history result remains unchanged.</p><details class="periodic-assumptions"><summary>Declared common-sensor model</summary><p>All listed sinusoidal components may coexist in one common additive sensor-offset process acting on both histories at their recorded acquisition indices. Independent sensors or condition-specific amplitudes are outside this model.</p></details><div class="periodic-workbench"><div class="periodic-controls">
 <label>Basis for bounds <input id="periodic-basis" type="text" maxlength="2000" placeholder="Source or assumption behind these bounds"></label>
 <label>Components: period in acquisition steps, amplitude bound in N·m
 <textarea id="periodic-components" rows="4" style="width:100%;box-sizing:border-box">[{"period":4,"amplitudeBound":0.3}]</textarea></label>
 <button id="periodic-inspect" type="button">Inspect current paired evidence</button>
 <button id="periodic-save" type="button" disabled>Save evidence and bounds</button>
 <label>Reopen evidence and bounds <input id="periodic-open" type="file" accept="application/json"></label>
 <p id="periodic-status" role="status" aria-live="polite">Declare a basis, then inspect. The example bounds are not sensor calibration.</p></div>
 <div id="periodic-result" aria-label="Observed contrast and bounded explanation"></div></div>`;
 document.querySelector('.verdict-band').after(root);
 const $=id=>root.querySelector('#'+id),basis=$('periodic-basis'),components=$('periodic-components'),status=$('periodic-status'),out=$('periodic-result'),save=$('periodic-save');
 let retained=null,generation=0;
 function invalidate(message='Evidence or bounds changed; inspect again.'){
  generation++;retained=null;save.disabled=true;out.replaceChildren();status.textContent=message;
 }
 basis.oninput=components.oninput=()=>invalidate();
 const fmt=x=>x.toPrecision(6);
 function receive(raw,label){
  const r=inspectPeriodicContrast(raw);retained=r.inputs;save.disabled=false;
  status.textContent=label+' · '+r.status+'. Source: '+r.inputs.notebook.source+' · '+r.inputs.sourceNote;
  out.replaceChildren();
  const paragraph=text=>{const p=document.createElement('p');p.textContent=text;out.append(p);};
  paragraph(`Original contrast ${fmt(r.original.decisionDifference)} N·m; original ${r.original.verdict} screen ±${fmt(r.original.boundary)} N·m. Declared combined artifact bias ±${fmt(r.biasBound)} N·m.`);
  paragraph(`Contrast after allowing only bounded artifacts: [${r.artifactOnlyInterval.map(fmt).join(', ')}] N·m. Including the unchanged descriptive screen: [${r.screenedInterval.map(fmt).join(', ')}] N·m. Numerical zero-comparison tolerance ${fmt(r.numericalTolerance)} N·m.`);
  // Direct evidence-versus-explanation axis rather than an unrelated dashboard chart.
  const extent=Math.max(1e-9,...r.screenedInterval.map(Math.abs),Math.abs(r.original.decisionDifference))*1.1;
  const x=v=>30+(v+extent)/(2*extent)*540;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 110');svg.setAttribute('role','img');svg.setAttribute('aria-label','Original contrast and artifact-sensitive interval relative to zero');svg.style.width='100%';svg.style.maxWidth='800px';
  const line=(a,b,y,color,width)=>{const el=document.createElementNS(ns,'line');for(const [k,v] of Object.entries({x1:x(a),x2:x(b),y1:y,y2:y,stroke:color,'stroke-width':width}))el.setAttribute(k,String(v));svg.append(el);};
  line(-extent,extent,80,'currentColor',1);line(...r.screenedInterval,50,'#bb6bd9',10);line(...r.artifactOnlyInterval,50,'#00b8d4',5);
  for(const [value,color] of [[0,'currentColor'],[r.original.decisionDifference,'#f3a324']]){const l=document.createElementNS(ns,'line');for(const [k,v] of Object.entries({x1:x(value),x2:x(value),y1:20,y2:85,stroke:color,'stroke-width':2}))l.setAttribute(k,String(v));svg.append(l);}
  out.append(svg);paragraph('Gold: observed contrast. Cyan: bounded-artifact interval. Purple: interval plus original screen. Thin reference: zero. Bounds are declared, not inferred.');
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Inspect an extremizing sensor-offset witness';details.append(summary);
  const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=JSON.stringify({originAcquisitionIndex:r.origin,components:r.artifacts,witnessContrast:r.witnessContrast,witnessResidual:r.witnessResidual,readings:r.witness},null,2);details.append(pre);out.append(details);
  paragraph('This witness maximizes positive contrast bias; reversing every offset attains the negative bound. It is a constructed explanation, never a measured or fitted sensor trace.');paragraph(r.interpretation);
 }
 $('periodic-inspect').onclick=()=>{invalidate();try{if(components.value.length>10000)throw Error('Keep component declarations below 10 KB.');receive({schema:PERIODIC_CONTRAST_SCHEMA,notebook:getNotebook(),sourceNote:basis.value,periodUnit:'acquisition_steps',amplitudeUnit:'N*m',components:JSON.parse(components.value)},'Current evidence snapshot');}catch(e){status.textContent=e.message;}};
 save.onclick=()=>{if(!retained)return;const url=URL.createObjectURL(new Blob([JSON.stringify(retained,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldlaw-periodic-contrast.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
 $('periodic-open').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;invalidate();const token=generation;try{if(file.size>250000)throw Error('Use input JSON under 250 KB.');const text=await file.text();if(token!==generation)return;const raw=JSON.parse(text);receive(raw,'Reopened evidence snapshot; main paired evidence is unchanged');basis.value=retained.sourceNote;components.value=JSON.stringify(retained.components,null,2);}catch(err){if(token===generation){retained=null;save.disabled=true;out.replaceChildren();status.textContent=err.message;}}finally{if(token===generation)e.target.value='';}};
 return {invalidate};
}
