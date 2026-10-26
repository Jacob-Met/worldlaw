import {prospectiveResponse} from './prospective-response.mjs';
import {inspectScalarExcitation} from './excitation-design.mjs';
import {TERMS} from './torque-discovery.mjs';
const schema='worldlaw.scalar-excitation-input/v1',responseSchema='worldlaw.scalar-excitation-input/v2';
const display=value=>Number(value.toPrecision(5)).toString();
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export function mountScalarExcitation(host,{getState,saveNotebook,openNotebook,useInput,getSourceGeneration=()=>0,beginSourceReplacement=()=>getSourceGeneration()}){
 const box=node('details');box.id='scalar-excitation';box.style.marginTop='1rem';box.append(node('summary','Which permitted input breaks coefficient confounding?'));
 box.append(node('p','Compare the input design before requesting another torque reading. This inspect-only calculation can reveal useful excitation even when refused structures have no forecasts.'));
 const terms=node('fieldset');terms.style.display='grid';terms.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';terms.append(node('legend','Explicit scalar basis to investigate'));
 const checks=TERMS.map(term=>{const label=node('label'),input=node('input');input.type='checkbox';input.value=term.id;label.append(input,document.createTextNode(` ${term.label} `));terms.append(label);return input;});box.append(terms);
 const label=node('label','Permitted input states (JSON array; command N·m, position rad, rate rad/s)'),input=node('textarea');input.id='excitation-inputs';input.rows=5;input.style.width='100%';input.style.boxSizing='border-box';input.value='[]';label.htmlFor=input.id;box.append(label,input);
 const inspect=node('button','Compare permitted inputs'),save=node('button','Save input-design case'),open=node('button','Open input-design case'),file=node('input');file.type='file';file.accept='.json';file.hidden=true;
 for(const button of [inspect,save,open]){button.type='button';button.className='button button-secondary';button.style.margin='0.25rem 0';}box.append(inspect,save,open,file);
 const sensitivityLabel=node('label'),sensitivity=node('input');sensitivity.type='checkbox';sensitivity.id='excitation-response-enabled';sensitivityLabel.append(sensitivity,document.createTextNode(' Also compare reading-error amplification at declared query coordinates'));box.append(sensitivityLabel);
 const queryLabel=node('label','Query coordinates (JSON inputs only, no torque observations)'),queryInput=node('textarea');queryInput.id='excitation-queries';queryLabel.htmlFor=queryInput.id;queryInput.rows=4;queryInput.style.width='100%';queryInput.style.boxSizing='border-box';queryInput.value='[]';
 const radiusLabel=node('label','Absolute perturbation bound on each original and future torque reading (N·m)'),radiusInput=node('input');radiusInput.id='excitation-reading-radius';radiusInput.type='number';radiusInput.min='0';radiusInput.max='1000000';radiusInput.step='any';radiusInput.value='0.01';radiusLabel.htmlFor=radiusInput.id;const sensitivityInputs=node('div');sensitivityInputs.hidden=true;sensitivityInputs.append(queryLabel,queryInput,radiusLabel,radiusInput);box.append(sensitivityInputs);sensitivity.addEventListener('change',()=>{sensitivityInputs.hidden=!sensitivity.checked;});
 const output=node('div');output.setAttribute('aria-live','polite');box.append(output);host.append(box);
 let generation=0,initialized=false,fileReadSerial=0;
 const declarations=()=>({terms:checks.filter(c=>c.checked).map(c=>c.value),permitted:JSON.parse(input.value),...(sensitivity.checked?{queries:JSON.parse(queryInput.value),readingRadius:Number(radiusInput.value)}:{})});
 function run(){const source=getState(),d=declarations();if(d.terms.some(id=>!source.discovery.options.terms.includes(id)))throw new Error('Only terms in the current offered library may be investigated.');const result=inspectScalarExcitation(source.discovery.observations,d.permitted,d.terms);output.replaceChildren();
  output.append(node('p',result.status==='work-limit'?`Complete calculation refused: ${result.work} work units exceeds ${result.workLimit}. No states were scored.`:`Current design rank ${result.rank}/${result.terms.length}; ${result.unresolved} unresolved directions. ${result.selected?'A permitted input increases numerical rank.':result.status==='full-rank'?'This basis already has full numerical rank.':'None of these permitted inputs increases numerical rank.'}`));
  if(result.results.length){const table=node('table'),head=node('tr');for(const text of ['Input (u, θ, ω)','Rank after reading','Gain'])head.append(node('th',text));const thead=node('thead');thead.append(head);table.append(thead);const body=node('tbody');
   for(const row of result.results){const tr=node('tr'),inputCell=node('td',`${row.index+1}: ${row.input.command}, ${row.input.position}, ${row.input.rate}${row.repeated?' (already observed)':''}`),button=node('button',`Use input ${row.index+1}`);button.type='button';button.className='button button-outline';button.style.padding='0.2rem 0.3rem';button.style.width='100%';button.style.whiteSpace='normal';button.addEventListener('click',()=>useInput(row.input));inputCell.append(button);tr.append(inputCell,node('td',`${row.rank}/${result.terms.length}`),node('td',String(row.gain)));for(const cell of tr.children){cell.style.overflowWrap='anywhere';cell.style.verticalAlign='top';}body.append(tr);}table.append(body);table.style.tableLayout='fixed';table.style.width='100%';for(const [i,cell] of [...head.children].entries())cell.style.width=[50,30,20][i]+'%';const region=node('div');region.style.maxWidth='100%';region.style.overflowX='auto';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','Complete input and rank comparison');region.append(table);output.append(region);}

  output.append(node('p',result.interpretation),node('p',`Normalized QR tolerance ${result.rankTolerance}. Appending a row may alter numerical scaling; the actual fitter must receive the acquired reading before coefficients are admitted. Earlier model forecasts and the nominal disagreement planner are unchanged.`));if(sensitivity.checked){
   if(!radiusInput.value.trim())throw new Error('Declare a reading perturbation radius.');
   const response=prospectiveResponse(source.discovery.observations,d.permitted,d.queries,d.terms,d.readingRadius);
   output.append(node('h4','Prospective fixed-basis reading sensitivity'),node('p',response.scope));
   if(response.status==='work-limit')output.append(node('p',`Complete sensitivity course refused: ${response.work} work units. Rank-only comparison above remains separate.`));
   else for(const offer of response.offers){const detail=node('details');detail.append(node('summary',offer.status==='computed'?`Input ${offer.index+1}: maximum declared-query half-width ${display(offer.maxHalfWidth)} N·m`:`Input ${offer.index+1}: full-basis QR unavailable`));
    for(const q of offer.queries){detail.append(node('p',`Query ${q.queryIndex+1}: u=${q.input.command}, θ=${q.input.position}, ω=${q.input.rate}; ±${display(q.halfWidth)} N·m sensitivity.`));const witness=node('details');witness.append(node('summary','Inspect original-row and future-reading influence witness'));const pre=node('pre',JSON.stringify({originalRowCount:response.training.length,futureReadingIndex:response.training.length,weights:q.weights,upperWitnessOffsets:q.upperWitnessOffsets},null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';witness.append(pre);detail.append(witness);}output.append(detail);}
   output.append(node('p','No future response center is predicted or acquired here. Each query has its own mathematical perturbation witness, including one hypothetical future reading. Original and future reading bounds are declarations; coordinates and the offered basis are fixed exactly. This does not bound model error or select a valid physical law. Floating-point QR is not certified interval arithmetic.'));
  }return d;
 }
 const guarded=fn=>{try{fn();}catch(error){output.replaceChildren(node('p',`Input-design unavailable: ${error.message}`));}};
 inspect.addEventListener('click',()=>guarded(run));
 save.addEventListener('click',()=>guarded(()=>{const d=run(),blob=new Blob([JSON.stringify({schema:sensitivity.checked?responseSchema:schema,notebook:JSON.parse(saveNotebook()),...d},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='worldlaw-scalar-excitation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
 open.addEventListener('click',()=>file.click());
 file.addEventListener('change',async()=>{
  const selected=file.files?.[0];if(!selected)return;
  // This case carries an entire source notebook; it shares replacement order
  // with the main imports and the other source-reopening investigations.
  const version=++generation,read=++fileReadSerial,sourceToken=beginSourceReplacement();
  const ownsSource=()=>version===generation&&sourceToken===getSourceGeneration()&&box.isConnected;
  try{
   if(selected.size>2_000_000)throw new Error('Input-design case exceeds 2 MB.');
   const text=await selected.text();if(!ownsSource())return;
   const raw=JSON.parse(text);
   if(![schema,responseSchema].includes(raw?.schema))throw new Error('Unsupported input-design case.');
   const restored=openNotebook(JSON.stringify(raw.notebook),true);
   if(!Array.isArray(raw.terms)||raw.terms.some(id=>!restored.discovery.options.terms.includes(id)))throw new Error('Case terms must belong to its notebook library.');
   inspectScalarExcitation(restored.discovery.observations,raw.permitted,raw.terms);
   if(raw.schema===responseSchema)prospectiveResponse(restored.discovery.observations,raw.permitted,raw.queries,raw.terms,raw.readingRadius);
   openNotebook(JSON.stringify(raw.notebook));
   input.value=JSON.stringify(raw.permitted,null,2);sensitivity.checked=raw.schema===responseSchema;sensitivityInputs.hidden=!sensitivity.checked;
   queryInput.value=JSON.stringify(raw.queries??[],null,2);radiusInput.value=String(raw.readingRadius??.01);
   checks.forEach(c=>{c.checked=raw.terms.includes(c.value);});run();
  }catch(error){if(ownsSource())output.replaceChildren(node('p',`Input-design unavailable: ${error.message}`));}
  finally{
   // Adoption calls studioChanged() on this same mounted panel. A separate
   // read serial allows successful same-file reopen without clearing a newer read.
   if(read===fileReadSerial&&file.files?.[0]===selected&&box.isConnected)file.value='';
  }
 });
 for(const e of [input,queryInput,radiusInput,sensitivity,...checks])e.addEventListener('input',()=>{generation++;output.replaceChildren(node('p','Declarations changed. Compare again before using a result.'));});
 return {studioChanged(){generation++;const offered=getState().discovery.options.terms;for(const c of checks){c.disabled=!offered.includes(c.value);if(!initialized)c.checked=!c.disabled;else if(c.disabled)c.checked=false;}initialized=true;output.replaceChildren(node('p','Source or model assumptions changed. Compare the declared inputs again.'));}};
}
