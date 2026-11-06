import test from 'node:test';
import assert from 'node:assert/strict';
import {mountLocalMotionComparison} from '../src/science/local-motion-comparison-panel.mjs';

// Follows maintained epoch-panel-handlers/time-support-panel tests: authored
// DOM nodes plus actual exported panel and registered toggle handler. This is
// source-fixture receiving, not browser layout, focus, event scheduling or physics.
class Element {
  constructor(tag,ids){this.tag=tag;this.ids=ids;this.children=[];this.events={};this.attrs={};this.dataset={};this.hidden=false;this.open=false;this._text='';}
  set id(value){this._id=value;this.ids.set(value,this);}
  get id(){return this._id;}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this._text='';this.children=[...nodes];}
  setAttribute(name,value){this.attrs[name]=String(value);}
  addEventListener(name,handler){this.events[name]=handler;}
}
function setup(t){
  const previous=globalThis.document,ids=new Map();
  globalThis.document={createElement:tag=>new Element(tag,ids)};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const host=new Element('main',ids),panel=mountLocalMotionComparison(host);
  const get=suffix=>ids.get('studio-local-motion-'+suffix);
  const details=get('comparison');
  const open=value=>{details.open=value;details.events.toggle();};
  return {panel,get,details,open,rows:()=>get('rows').children};
}
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freeze);Object.freeze(value);
  }
  return value;
};

// Deliberately authored display report, not a solver-generated numerical control.
// Repeated IDs/equations and visibly different own states expose accidental ID joins.
function fixture(statuses=['available','available']){
  const times=[0,.25,.5];
  const results=statuses.map((status,index)=>{
    const model={id:'same-id',equation:'same equation',schema:'authored display fixture',terms:[{id:'spring',coefficient:-4*(index+1)}]};
    const course={source:{model,inertia:2,command:.5},rows:times.map((time,j)=>({
      index:j,time,position:(index+1)*10+j,rate:status==='nonsmooth'?0:index+j/10,
      torqueByPosition:-(index+1)*4,torqueByRate:status==='nonsmooth'?null:-index,
      status,reason:status==='nonsmooth'?'Nonzero sign-rate derivative is unavailable at zero rate.':status==='unresolved_numeric'?'Retained numerical underflow refusal.':undefined,
      modes:status==='available'?{status:'available',eigenvalues:[{real:-index,imaginary:index+2},{real:-index,imaginary:-(index+2)}],nearRepeated:false}:null
    }))};
    return {index,id:model.id,equation:model.equation,model,executionStatus:status==='refused'?'refused':'completed',
      response:status==='refused'?{status:'refused',error:{message:'Original law exceeded its reserved work.'}}:{status:'computed',course}};
  });
  const completed=results.filter(row=>row.executionStatus==='completed');
  const counts={computedLaws:completed.length,refusedLaws:results.length-completed.length,available:statuses.filter(s=>s==='available').length*3,nonsmooth:statuses.filter(s=>s==='nonsmooth').length*3,unresolvedNumeric:statuses.filter(s=>s==='unresolved_numeric').length*3,stationaryEquation:0,executedStates:completed.length*3};
  return {schema:'worldlaw.local-motion-comparison/v1',status:counts.refusedLaws?'incomplete':'completed',candidateCount:results.length,results,responseCounts:counts,
    motion:{status:counts.refusedLaws?'incomplete':'completed',candidateCount:results.length,completedCount:completed.length,refusedCount:counts.refusedLaws,initial:{position:1,rate:0},settings:{inertia:2,command:.5,duration:.5,dt:.25},work:{description:'Authored display fixture'},
      results:results.map(row=>({index:row.index,id:row.id,equation:row.equation,status:row.executionStatus,...(row.executionStatus==='completed'?{trajectory:row.response.course.rows.map(({time,position,rate})=>({time,position,rate}))}:{error:{message:'Original law exceeded its reserved work.'}})}))},
    interpretation:'Authored presentation fixture only.'};
}

test('shared exact sample binds duplicate labels to their own original state and modes',t=>{
  const {panel,get,open,rows}=setup(t),report=freeze(fixture());
  const before=JSON.stringify(report);
  panel.setReport(report,'Current competitive-law predictions');panel.setSample(1);
  assert.equal(rows().length,0,'closed readout does not build per-clock rows');open(true);
  assert.deepEqual(rows().map(row=>row.dataset.originalIndex),['0','1']);
  assert.deepEqual(rows().map(row=>row.children[0].textContent),['L1 · same equation','L2 · same equation']);
  assert.deepEqual(rows().map(row=>row.children[1].textContent),['θ 11 rad · ω 0.1 rad/s','θ 21 rad · ω 1.1 rad/s']);
  assert.match(rows()[0].children[3].textContent,/0 \+ 2i; 0 − 2i/);
  assert.match(rows()[1].children[3].textContent,/-1 \+ 3i; -1 − 3i/);
  assert.match(get('time').textContent,/Exact sample 1 · t 0.25 s/);
  panel.setSample(2);assert.equal(rows()[1].children[1].textContent,'θ 22 rad · ω 1.2 rad/s');
  assert.equal(JSON.stringify(report),before,'source report remains unchanged');
});

test('historical provenance and whole-course counts stay distinct from selected instant',t=>{
  const {panel,get,open,rows}=setup(t),label='Before outcome 2: original two-law fit from 97 earlier rows; recomputed now.';
  panel.setReport(freeze(fixture()),label);open(true);panel.setSample(2);
  assert.equal(get('source').textContent,label);
  assert.match(get('counts').textContent,/2 of 2 original laws/);
  assert.match(get('counts').textContent,/Whole-course sample counts: 6 available/);
  assert.match(get('counts').textContent,/not counts at the selected instant/);
  assert.equal(rows().length,2);assert.match(get('time').textContent,/Exact sample 2 · t 0.5 s · inertia 2 kg·m² · fixed command 0.5 N·m/);
});

test('refused, nonsmooth and unresolved laws remain with partial derivative availability',t=>{
  const {panel,get,open,rows}=setup(t);
  panel.setReport(freeze(fixture(['available','nonsmooth','unresolved_numeric','refused'])),'Current source');open(true);panel.setSample(1);
  assert.deepEqual(rows().map(row=>row.dataset.originalIndex),['0','1','2','3']);
  assert.deepEqual(rows().map(row=>row.dataset.status),['available','nonsmooth','unresolved_numeric','refused']);
  assert.match(rows()[1].children[2].textContent,/∂τ\/∂θ -8 N·m\/rad; ∂τ\/∂ω unavailable/);
  assert.match(rows()[1].children[3].textContent,/nonsmooth: Nonzero sign-rate/);
  assert.match(rows()[2].children[3].textContent,/unresolved_numeric: Retained numerical underflow refusal/);
  assert.equal(rows()[3].children[1].textContent,'No complete executed trajectory');
  assert.match(rows()[3].children[3].textContent,/Original law exceeded its reserved work/);
  assert.match(get('counts').textContent,/3 of 4 original laws.*1 refused/);
  assert.match(get('counts').textContent,/3 available, 3 nonsmooth, 3 numerically unresolved/);
});

test('all-refused population retains every original row without inventing a clock instant',t=>{
  const {panel,get,open,rows}=setup(t);
  panel.setReport(freeze(fixture(['refused','refused'])),'Earlier source');open(true);panel.setSample(1);
  assert.equal(rows().length,2);assert.deepEqual(rows().map(row=>row.dataset.originalIndex),['0','1']);
  assert.equal(get('time').textContent,'No shared executed instant is available.');
  assert.match(get('counts').textContent,/0 of 2 original laws.*2 refused/);
  for(const row of rows())assert.match(row.children[3].textContent,/Original law exceeded/);
});

test('retirement and staged unavailability clear prior response and cannot revive it by scrubbing',t=>{
  const {panel,get,details,open,rows}=setup(t);
  panel.setReport(freeze(fixture()),'Old current source');open(true);assert.equal(rows().length,2);
  panel.retire();assert.equal(details.hidden,true);assert.equal(rows().length,0);
  for(const name of ['source','time','counts'])assert.equal(get(name).textContent,'');
  panel.setSample(2);open(true);assert.equal(rows().length,0);assert.equal(details.hidden,true);
  panel.setReport(freeze(fixture(['available'])),'New historical source');assert.equal(rows().length,1);
  assert.equal(get('source').textContent,'New historical source');assert.match(get('time').textContent,/Exact sample 0/);
  panel.unavailable('Staged baseline has no bound local-response course.');
  assert.equal(details.hidden,false);assert.equal(rows().length,0);assert.equal(get('counts').textContent,'');
  panel.setSample(1);open(true);assert.equal(rows().length,0);
  assert.equal(get('time').textContent,'Staged baseline has no bound local-response course.');
  assert.doesNotMatch(get('source').textContent,/New historical source|Old current source/);
});

test('invalid exact sample refuses without substituting the nearest or previous state',t=>{
  const {panel,get,open,rows}=setup(t);
  panel.setReport(freeze(fixture()),'Current');open(true);panel.setSample(1);
  for(const invalid of [1.5,99,-1]){
    panel.setSample(invalid);assert.match(get('time').textContent,/Local readout unavailable/);
    assert.equal(rows().length,2);
    for(const row of rows())assert.match(row.children[1].textContent,/No value substituted/);
  }
  panel.setSample(0);assert.match(get('time').textContent,/Exact sample 0 · t 0 s/);
  assert.equal(rows()[0].children[1].textContent,'θ 10 rad · ω 0 rad/s');
});

test('opening and scrubbing read cached reports without comparator cloning or model-term access',t=>{
  const {panel,get,open,rows}=setup(t),report=fixture();
  let modelReads=0,clones=0;
  // Frozen trap models are valid identity placeholders for the sample selector.
  // Any fresh predictor access or compareLocalMotion's clone would fail this course.
  for(const outcome of report.results){
    const model=Object.freeze({id:'same-id',get terms(){modelReads++;throw new Error('Unexpected predictor access');}});
    outcome.model=model;outcome.response.course.source.model=model;
  }
  const clone=globalThis.structuredClone;
  globalThis.structuredClone=()=>{clones++;throw new Error('Unexpected comparator clone');};
  try {
    panel.setReport(report,'Cached exact course');open(true);
    panel.setSample(1);panel.setSample(2);open(false);panel.setSample(0);open(true);
    assert.equal(rows().length,2);assert.match(get('time').textContent,/Exact sample 0/);
    assert.equal(modelReads,0);assert.equal(clones,0);
  } finally {globalThis.structuredClone=clone;}
});


test('a later-row rendering exception leaves only the complete fallback population',t=>{
  const {panel,open,rows}=setup(t);
  panel.setReport(freeze(fixture()),'Current source');
  const create=globalThis.document.createElement;
  let rowAttempts=0,priorRowsAtFault=null;
  globalThis.document.createElement=tag=>{
    if(tag==='tr'&&++rowAttempts===2){
      priorRowsAtFault=rows().length;
      throw new Error('One-shot second-law rendering failure');
    }
    return create(tag);
  };
  try {open(true);} finally {globalThis.document.createElement=create;}
  assert.equal(priorRowsAtFault,1,'first law was already appended before the injected failure');
  assert.deepEqual(rows().map(row=>row.dataset.originalIndex),['0','1']);
  assert.equal(rows().length,2,'no partial row survives alongside the complete fallback');
  for(const row of rows()){
    assert.equal(row.children.length,2);
    assert.equal(row.children[1].textContent,'No value substituted for the unavailable exact sample.');
    assert.doesNotMatch(row.textContent,/θ|rad\/s|N·m/,'no prior own-state or derivative value survives');
  }
});
