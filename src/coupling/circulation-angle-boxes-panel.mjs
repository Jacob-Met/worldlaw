import {analyzeCirculationBoxes,exportCirculationBoxes,importCirculationBoxes,CIRCULATION_BOX_SCHEMA,CIRCULATION_BOX_ASSUMPTION} from './circulation-angle-boxes.mjs';
import {displayExact,angleBoxWitnessRow} from '../cycle-work/angle-boxes.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export function appendCirculationBoxes(out,comparison){
 const host=node('details');host.id='circulation-angle-boxes';host.append(node('summary','Does circulation survive coordinate measurement uncertainty?'));
 const intro=node('p','Reuse the original loop and torque bounds with independent angular reading boxes. Each coordinate has one shared first/last return angle. This inspects observed polygon work only; it does not change or receive fitted laws.');host.append(intro);
 const label=node('label','Angular radii and source declaration · rad');label.htmlFor='circulation-box-input';
 const input=node('textarea');input.id='circulation-box-input';input.rows=12;input.spellcheck=false;input.style.cssText='width:100%;max-width:100%;box-sizing:border-box';
 input.value=exportCirculationBoxes({schema:CIRCULATION_BOX_SCHEMA,assumption:CIRCULATION_BOX_ASSUMPTION,radiusSource:'Zero radii copied from the nominal path; replace with your declared measurement bounds',path:comparison.observed.input,positionRadii:comparison.observed.input.samples.map(()=>[0,0])});
 const run=node('button','Inspect coordinate boxes');run.type='button';run.id='circulation-box-run';
 const save=node('button','Save bounded-loop inputs');save.type='button';save.id='circulation-box-save';save.disabled=true;
 const openLabel=node('label','Reopen bounded-loop inputs · at most 4 MiB'),open=node('input');open.type='file';open.accept='.json,application/json';open.id='circulation-box-open';openLabel.append(open);
 const status=node('p');status.id='circulation-box-status';status.setAttribute('role','status');
 const resultHost=node('div');resultHost.id='circulation-box-result';let result=null,generation=0;
 const invalidate=()=>{generation++;result=null;save.disabled=true;resultHost.replaceChildren();status.textContent='Inputs changed. Inspect to recompute.';};
 function draw(){
  resultHost.replaceChildren();const r=result;
  resultHost.append(node('h4',`${r.bundle.path.source.kind==='synthetic'?'Synthetic':'User-declared measured'}: ${r.bundle.path.source.label}`));
  resultHost.append(node('p',`[${r.interval.map(displayExact).join(', ')}] J · ${r.conclusion}. Polygon extrema [${displayExact(r.minimum.work)}, ${displayExact(r.maximum.work)}] J. Integration allowance ±${r.bundle.path.integrationAllowance} J is included once. Displayed decimals are approximate; exact integer arithmetic determines the sign.`));
  resultHost.append(node('p','Radius source: '+r.bundle.radiusSource),node('p',r.scope));
  const choiceLabel=node('label','Mathematical endpoint witness '),choice=node('select');choice.id='circulation-box-extreme';
  for(const name of ['minimum','maximum']){const option=node('option',name+' polygon work');option.value=name;choice.append(option);}choiceLabel.append(choice);
  const rowLabel=node('label','Original acquisition row '),row=node('input');row.type='number';row.min='1';row.max=String(r.bundle.path.samples.length);row.step='1';row.value='1';row.id='circulation-box-row';rowLabel.append(row);
  const ledger=node('pre');ledger.id='circulation-box-witness';ledger.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:22rem;overflow:auto';
  resultHost.append(choiceLabel,rowLabel,node('p','Both coordinate witnesses attain the same joint extremum because their boxes are independent. Endpoints are mathematical assignments, not acquired readings.'),ledger);
  const inspect=()=>{const index=Number(row.value)-1;if(!Number.isInteger(index)||index<0||index>=r.bundle.path.samples.length){ledger.textContent='Choose an original acquisition row.';return;}
   ledger.textContent=JSON.stringify({row:index+1,extremum:choice.value,work:r[choice.value].work,coordinates:r.axes.map(a=>a.status==='exact-constant'?{axis:a.axis+1,status:'exact constant coordinate',position:r.bundle.path.samples[index].q[a.axis]}:{axis:a.axis+1,...angleBoxWitnessRow(a.bundle,a[choice.value].corners,index)})},null,2);
  };choice.addEventListener('change',inspect);row.addEventListener('input',inspect);inspect();save.disabled=false;
 }
 run.addEventListener('click',()=>{invalidate();try{result=analyzeCirculationBoxes(importCirculationBoxes(input.value));draw();status.textContent='Complete bounded polygon inspected. Nominal law comparison is unchanged.';}catch(e){status.textContent=e.message;}});
 input.addEventListener('input',invalidate);
 save.addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([exportCirculationBoxes(result.bundle)],{type:'application/json'})),a=node('a');a.href=url;a.download='worldlaw-coupled-angle-boxes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 open.addEventListener('change',async()=>{const file=open.files?.[0];if(!file)return;const ticket=++generation;try{if(file.size>4*1024*1024)throw Error('Bounded circulation input exceeds 4 MiB.');const text=await file.text();if(ticket!==generation||!host.isConnected)return;const next=importCirculationBoxes(text);input.value=exportCirculationBoxes(next);invalidate();status.textContent='Loaded independent saved loop inputs. Inspect to recompute; this does not replace the nominal comparison above.';}catch(e){if(ticket===generation&&host.isConnected)status.textContent=e.message+' Previous inputs retained.';}finally{if(open.files?.[0]===file)open.value='';}});
 host.append(label,input,run,save,openLabel,status,resultHost,node('p','A constant nominal coordinate with nonzero angular radii currently refuses explicitly. Other measurement correlations are unsupported. No physical full-state closure or continuous-path work is established.'));out.append(host);
}
