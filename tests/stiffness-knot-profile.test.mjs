import test from 'node:test';
import assert from 'node:assert/strict';
import {profileStiffnessKnots,MAX_PROFILE_WORK} from '../src/stiffness/knot-profile.mjs';
import {investigateStiffness,predictStiffness,evaluateStiffness} from '../src/stiffness/science.mjs';
import {createStiffnessStudy,exportStiffnessStudy,importStiffnessStudy} from '../src/stiffness/notebook.mjs';

const settings={knots:[-.75,-.5,-.25,0,.25,.5,.75],nuisanceTerms:['bias'],noiseSigma:1e-7,ambiguityDelta:6};
const law=(position,knot=.137)=>.2-1.4*position+3.7*Math.max(0,position-knot);
function course(knot=.137,{count=31,noise=0,scale=1,offset=0}={}){
 return Array.from({length:count},(_,i)=>{
  const x=-1+2*i/(count-1),position=offset+scale*x;
  return {position,command:0,rate:0,jointTorque:law(x,knot)+noise*Math.sin(2.17*i)};
 });
}
function settingsAt(scale,offset){return {...settings,knots:settings.knots.map(k=>offset+scale*k)};}

test('a transition between offered knots reaches the real maintained model and separate-grid predictions',()=>{
 const rows=course(),result=profileStiffnessKnots(rows,settings);
 assert.equal(result.status,'candidate_found');assert.ok(Math.abs(result.proposed.knot-.137)<1e-12);
 assert.ok(result.improvement.trainingRmseBefore>.09);assert.ok(result.improvement.trainingRmseAfter<1e-12);
 const heldOut=Array.from({length:37},(_,i)=>{const position=-.97+i*1.94/36;return{position,command:0,rate:0,jointTorque:law(position)}});
 assert.ok(evaluateStiffness(result.proposed,heldOut).rmse<1e-12);
 assert.equal(result.proposed.metrics.parameterCount,4);
 assert.equal(result.examinedIntervals,result.intervalCount);
 assert.equal(result.intervals.filter(i=>i.status==='insufficient_side_support').length,4);
 // The two unsupported domain endpoints remain explicit native refusals.
 for(const knot of [rows[2].position,rows.at(-3).position])
  assert.equal(result.profile.find(p=>p.family==='piecewise'&&p.knot===knot).status,'insufficient_side_support');
});

test('independent non-grid knot controls survive nuisance terms, row order and repeat observations',()=>{
 for(const knot of [-.413,-.071,.137,.519]){
  const rows=course(knot).flatMap((row,i)=>[[0,0],[.7,-.4],[-.6,.5],[.3,.6]].map(([command,rate])=>
   ({...row,command,rate,jointTorque:row.jointTorque+.8*command-.25*rate})));
  const s={...settings,nuisanceTerms:['bias','command','rate']};
  const result=profileStiffnessKnots(rows,s),reversed=profileStiffnessKnots([...rows].reverse(),s);
  assert.ok(Math.abs(result.proposed.knot-knot)<1e-10);
  assert.ok(Math.abs(reversed.proposed.knot-knot)<1e-10);
  assert.ok(result.proposed.metrics.rmse<1e-12);
  for(const row of rows)assert.ok(Math.abs(predictStiffness(result.proposed,row)-row.jointTorque)<1e-10);
 }
});

test('profile proposals compete with a separately enumerated fine grid on noisy and omitted-family controls',()=>{
 for(const kind of ['noisy','two-hinge','smooth']){
  const rows=course(.137,{noise:kind==='noisy'?.015:0}).map(row=>({...row,jointTorque:kind==='two-hinge'?
   row.jointTorque-2.1*Math.max(0,row.position+.37):kind==='smooth'?.2-1.4*row.position-.9*row.position**3:row.jointTorque}));
  const s={...settings,noiseSigma:.001},result=profileStiffnessKnots(rows,s);
  const grid=Array.from({length:1001},(_,i)=>-.79+1.58*i/1000);
  let best=Infinity;
  for(let i=0;i<grid.length;i+=101){const fit=investigateStiffness(rows,{...s,knots:grid.slice(i,i+101)});best=Math.min(best,fit.selected.metrics.score);}
  assert.ok(result.selected.metrics.score<=best+1e-7,`${kind}: ${result.selected.metrics.score} vs ${best}`);
  if(kind!=='noisy')assert.ok(result.selected.metrics.rmse>.01,'omitted structure must retain its error');
 }
});

test('smooth global controls preserve the finite-grid choice and unchanged source data',()=>{
 const rows=course().map(row=>({...row,jointTorque:.3-1.2*row.position}));
 const original=JSON.stringify(rows),old=investigateStiffness(rows,settings),result=profileStiffnessKnots(rows,settings);
 assert.equal(result.status,'grid_retained');assert.equal(result.proposed,null);
 assert.deepEqual(result.gridSelected,old.selected);assert.equal(result.selected.family,'global');
 assert.equal(JSON.stringify(rows),original);
});

test('noise-floor score ties retain the declared winner in the API as well as the offered candidate',()=>{
 for(const noiseSigma of [.01,.1]){
  const s={...settings,knots:[.14],noiseSigma},grid=investigateStiffness(course(),s);
  const result=profileStiffnessKnots(course(),s);
  assert.equal(result.status,'grid_retained');assert.equal(result.proposed,null);
  assert.deepEqual(result.selected,grid.selected);
  assert.equal(result.improvement.scoreReduction,0);
  assert.equal(result.improvement.trainingRmseAfter,grid.selected.metrics.rmse);
 }
});

test('a finite interior neighbor improves an open-boundary case while the endpoint remains refused',()=>{
 // Independent review's frozen no-bias/two-hinge counterexample. The initial
 // endpoints/midpoints/stationary set had SSE 3.564933; a dense valid angle
 // already achieved 3.406737. Preserve the measured data and that challenge.
 const positions=[-1.923539105538365,-1.5528220715499268,-1.1721899815240304,-.7552492295783844,-.6915936296223664,-.6521845589526305,-.61743948109121,-.3224892416827214,-.14118591133357272,-.09006535404690874,.04492197610405135,.1888113590229752,.2624230611952125,.36278105537939354,.39775291754244835,1.2962383805406077,1.3603627114870913,1.6841191792022814,1.7862153305073272,1.9085243542782542];
 const torques=[-1.3861963936594628,-1.0911548216991187,-.8167948985591564,-.5460231330941153,-.502668782406881,-.42457360840417996,-.49612836495702256,-.6180563690818238,-.7300723293146248,-.7017186540796354,-.8216087611082342,-.9038967328778619,-.7869813753005663,-.6224889014831516,-.5782476821443736,.6429901381141998,.6880074994229873,1.1928924035469972,1.3181948542543211,1.5503097476543952];
 const rows=positions.map((position,i)=>({position,command:0,rate:0,jointTorque:torques[i]}));
 const s={...settings,knots:[-.5,0,.5],nuisanceTerms:[]};
 const result=profileStiffnessKnots(rows,s),boundary=positions[2];
 assert.ok(result.selected.knot>boundary&&result.selected.knot<positions[3]);
 assert.ok(result.selected.metrics.rmse**2*rows.length<3.406737);
 assert.equal(result.profile.find(p=>p.family==='piecewise'&&p.knot===boundary).status,'insufficient_side_support');
 const refit=investigateStiffness(rows,{...s,knots:[result.selected.knot]});
 assert.deepEqual(result.selected,refit.selected);
});

test('offered cubic alternative is preserved instead of falsely presenting its smooth response as a discovered hinge',()=>{
 const rows=course().map(row=>({...row,jointTorque:.3-1.2*row.position-.9*row.position**3}));
 const result=profileStiffnessKnots(rows,{...settings,cubicOrigin:0});
 assert.equal(result.status,'grid_retained');assert.equal(result.selected.family,'cubic');
 assert.equal(result.proposed,null);assert.ok(result.selected.metrics.rmse<1e-12);
});

test('coordinate scale and translation retain a non-grid transition without changing the torque law',()=>{
 for(const [scale,offset]of [[1e-4,0],[1,27],[1e4,-2e4]]){
  const result=profileStiffnessKnots(course(.137,{scale,offset}),settingsAt(scale,offset));
  assert.equal(result.status,'candidate_found');
  assert.ok(Math.abs((result.proposed.knot-offset)/scale-.137)<1e-8);
  assert.ok(result.proposed.metrics.rmse<1e-8);
 }
});

test('all candidates survive more than one native declaration batch',()=>{
 const rows=course(.137,{count:91}),result=profileStiffnessKnots(rows,settings);
 assert.ok(result.proposedKnots.length>101);
 const profile=new Set(result.profile.filter(p=>p.family==='piecewise').map(p=>p.knot));
 for(const knot of [...settings.knots,...result.proposedKnots])assert.ok(profile.has(knot));
 assert.equal(result.profile.filter(p=>p.family==='global').length,1);
 assert.ok(Math.abs(result.proposed.knot-.137)<1e-10);
});

test('confounding, too few distinct positions, nonfinite values and exhausted work never yield partial proposals',()=>{
 const confounded=course().map(row=>({...row,command:2*row.position}));
 const rank=profileStiffnessKnots(confounded,{...settings,nuisanceTerms:['bias','command']});
 assert.equal(rank.status,'baseline_rank_deficient');assert.equal(rank.proposed,null);
 const narrow=Array.from({length:12},(_,i)=>({...course()[i],position:i%3}));
 assert.equal(profileStiffnessKnots(narrow,settings).status,'insufficient_position_support');
 const limited=profileStiffnessKnots(course(),settings,{workLimit:1});
 assert.equal(limited.status,'work_limit');assert.equal(limited.examinedIntervals,0);
 assert.deepEqual(limited.proposedKnots,[]);assert.deepEqual(limited.candidates,[]);assert.equal(limited.proposed,null);
 assert.throws(()=>profileStiffnessKnots(course(),settings,{workLimit:MAX_PROFILE_WORK+1}),/work limit/);
 assert.throws(()=>profileStiffnessKnots(course(),settings,{unexpected:true}),/Unknown/);
 const bad=course();bad[0].position=NaN;assert.throws(()=>profileStiffnessKnots(bad,settings),/finite/);
});

test('separate-check mutations never enter proposals; explicit offering reopens through the maintained notebook',()=>{
 const dataset={observations:course(),heldOut:course(.55),source:{label:'Independent authored test',kind:'synthetic'}};
 const initial=createStiffnessStudy(dataset,settings),profile=profileStiffnessKnots(initial.dataset.observations,initial.settings);
 const changed=createStiffnessStudy({...dataset,heldOut:course().map(r=>({...r,jointTorque:1000-r.jointTorque}))},settings);
 assert.deepEqual(profileStiffnessKnots(changed.dataset.observations,changed.settings),profile);
 const offered=createStiffnessStudy(dataset,{...settings,knots:[...settings.knots,profile.proposed.knot]});
 const reopened=importStiffnessStudy(exportStiffnessStudy(offered));
 assert.deepEqual(reopened,offered);assert.ok(Math.abs(reopened.fit.selected.knot-.137)<1e-12);
 assert.ok(reopened.checks.find(c=>c.family==='piecewise'&&c.knot===reopened.fit.selected.knot).rmse>.5);
});
