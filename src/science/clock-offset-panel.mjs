import {inspectClockOffsets,exportClockInvestigation,reopenClockInvestigation} from './clock-offset.mjs';
import {clockOffsetExample} from './clock-offset-example.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fmt=n=>Number(n.toPrecision(5)).toString();
export function mountClockOffsets(parent,getModel) {
 const section=el('section');section.className='panel';section.id='clock-offset-investigation';section.style.cssText='min-width:0;padding:20px';
 const heading=el('h2','Test the instrument clock');section.append(heading,el('p','Could a timing offset explain a fixed law’s residual? Compare explicitly offered offsets against the same source states. The law stays fixed; challenge readings never choose the offset.'));
 const convention=el('p','Positive offset: torque-clock time = state-clock time + offset. This is a model-conditioned timing hypothesis, not an identified physical delay.');convention.className='input-hint';section.append(convention);
 const controls=el('div');controls.className='source-actions';controls.style.cssText='flex-wrap:wrap;justify-content:flex-start';
 function button(label,id,fn){const b=el('button',label);b.type='button';b.className='button button-outline';b.id=id;b.addEventListener('click',()=>{try{fn();}catch(e){invalidate();status.textContent=e.message;status.setAttribute('role','alert');}});controls.append(b);return b;}
 const status=el('p','Import timestamped state and torque evidence, or inspect the authored control.');status.id='clock-status';status.setAttribute('role','status');
 const modelLabel=el('p');modelLabel.id='clock-model';
 const editorLabel=el('label','Original inputs (JSON; seconds, radians, N·m)');editorLabel.htmlFor='clock-input';
 const editor=el('textarea');editor.id='clock-input';editor.rows=9;editor.spellcheck=false;editor.style.cssText='width:100%;max-width:100%;box-sizing:border-box;font:12px ui-monospace,monospace';
 const out=el('div');out.id='clock-results';
 const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='clock-file';
 let fixedModel=null,result=null,generation=0,studioOrigin=false;
 function invalidate(){generation++;result=null;out.replaceChildren();save.disabled=true;status.setAttribute('role','status');}
 function setModel(model,label,origin){fixedModel=structuredClone(model);studioOrigin=origin;modelLabel.textContent=`Fixed law: ${label}. Coefficients: ${fixedModel.terms.map(t=>`${t.id} ${fmt(t.coefficient)}`).join(', ')||'zero'}`;}
 button('Use inspected Studio law','clock-use-model',()=>{invalidate();setModel(getModel(),'snapshot of inspected Studio law',true);status.textContent='Fixed law captured. Enter separately timestamped evidence and compare.';});
 button('Authored delayed-sensor control','clock-example',()=>{invalidate();const example=clockOffsetExample();setModel(example.model,'authored unit command law; not the Studio fit',false);editor.value=JSON.stringify(example.input,null,2);status.textContent='Authored numerical control loaded. No physical acquisition is claimed.';});
 button('Open investigation / source','clock-open',()=>file.click());
 button('Compare offered offsets','clock-compare',()=>{invalidate();if(!fixedModel)throw new Error('Capture a Studio law or open an investigation first.');const input=JSON.parse(editor.value);result=inspectClockOffsets(fixedModel,input);render();save.disabled=false;});
 const save=button('Save original investigation','clock-save',()=>{if(!result)throw new Error('Compare current inputs before saving.');const text=exportClockInvestigation(fixedModel,JSON.parse(editor.value));const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=el('a');a.href=url;a.download='worldlaw-clock-investigation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});save.disabled=true;
 editor.addEventListener('input',()=>{invalidate();status.textContent='Inputs changed. Previous comparison retired; compare again.';});
 file.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;invalidate();const current=generation;try{if(f.size>2_000_000)throw new Error('Files must be at most 2 MB.');const text=await f.text();if(current!==generation)return;const source=JSON.parse(text);if(source.schema==='worldlaw.clock-investigation/v1'){const opened=reopenClockInvestigation(text);setModel(opened.model,'model saved with original investigation',false);editor.value=JSON.stringify(opened.input,null,2);result=opened.result;render();save.disabled=false;}else{editor.value=JSON.stringify(source,null,2);status.textContent='Source loaded. Capture a fixed law and compare.';}}catch(e){if(current===generation){invalidate();status.textContent=e.message;status.setAttribute('role','alert');}}finally{file.value='';}});
 function render(){
  out.replaceChildren();status.textContent=`${result.admittedStateIndices.length} common state rows; ${result.excludedStateIndices.length} excluded. ${result.selectedOffset===null?'No unique offered offset':`Training selects ${fmt(result.selectedOffset)} s`}. ${result.competitive.length} offered offsets within the declared training tolerance.`;
  // A residual profile exposes disagreement across clock hypotheses in the same instrument.
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 560 220');svg.style.width='100%';svg.setAttribute('role','img');svg.setAttribute('aria-label','Training and challenge torque residual against offered clock offset');
  const cs=[...result.candidates].sort((a,b)=>a.offset-b.offset),lo=Math.min(...cs.map(c=>c.offset)),hi=Math.max(...cs.map(c=>c.offset)),max=Math.max(1e-12,...cs.flatMap(c=>[c.training.rmse,c.challenge.rmse]));
  const x=n=>50+460*(n-lo)/(hi-lo||1),y=n=>175-145*n/max;
  function shape(tag,attrs,text){const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);return n;}
  shape('path',{d:'M50 20 V175 H525',fill:'none',stroke:'#53655f'});
  for(const [role,color]of [['training','#1c7562'],['challenge','#a34c28']]){shape('polyline',{points:cs.map(c=>`${x(c.offset)},${y(c[role].rmse)}`).join(' '),fill:'none',stroke:color,'stroke-width':2});for(const c of cs)shape('circle',{cx:x(c.offset),cy:y(c[role].rmse),r:3,fill:color});}
  shape('text',{x:50,y:15,'font-size':12},`RMSE (N·m), top ${fmt(max)}`);shape('text',{x:50,y:200,'font-size':12},`${fmt(lo)} s`);shape('text',{x:450,y:200,'font-size':12},`${fmt(hi)} s`);out.append(svg,el('p','Green: training; rust: challenge. Lines only connect offered hypotheses; no continuous search is implied.'));
  const wrap=el('div');wrap.style.cssText='max-width:100%;overflow-x:auto';const table=el('table');table.style.cssText='width:100%;border-collapse:collapse;font-size:13px;text-align:left';const head=el('tr');for(const s of ['Offset (s)','Training RMSE (N·m)','Challenge RMSE (N·m)','Training choice'])head.append(el('th',s));table.append(head);
  for(const c of cs){const row=el('tr');for(const v of [fmt(c.offset),fmt(c.training.rmse),fmt(c.challenge.rmse),result.competitive.includes(c.offset)?'Retained':'Outside tolerance'])row.append(el('td',v));table.append(row);}wrap.append(table);out.append(wrap);
  const details=el('details'),summary=el('summary','Inspect original source brackets and exclusions');details.append(summary);
  const select=el('select');select.id='clock-witness';select.setAttribute('aria-label','Offset source witness');for(const c of cs){const opt=el('option',`${fmt(c.offset)} seconds`);opt.value=String(c.offset);select.append(opt);}const pre=el('pre');pre.style.cssText='max-height:300px;overflow:auto;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere';const witness=()=>{pre.textContent=JSON.stringify({excludedStateIndices:result.excludedStateIndices,rows:cs.find(c=>c.offset===Number(select.value)).rows},null,2);};select.addEventListener('change',witness);witness();details.append(select,pre);out.append(details);
  for(const text of result.limitations)out.append(el('p',text));
 }
 section.append(controls,file,modelLabel,editorLabel,editor,status,out);parent.append(section);
 return {studioChanged(){if(studioOrigin){invalidate();fixedModel=null;modelLabel.textContent='Studio model/source changed. Capture the inspected law again.';status.textContent='Previous Studio snapshot retired.';}}};
}
