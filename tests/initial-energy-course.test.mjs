import test from 'node:test';
import assert from 'node:assert/strict';
import {compareOwnedEnergyCourse} from '../src/trajectory/initial-energy-course.mjs';
import {rational,serial} from '../src/unknown-lab/chronos-exact-halfplanes.mjs';
import {prepareInitialEnergyQuestion,exportInitialEnergyQuestion,reopenInitialEnergyQuestion} from '../src/trajectory/initial-energy-receipt.mjs';
const s=x=>serial(rational(x)), box=(a,b)=>[s(a),s(b)], raw=x=>String(BigInt(x)*(1n<<80n));
const rows=values=>values.map(([time,lo,hi],index)=>({index,time,position:lo,interval:box(lo,hi)}));
const check=(r,V=1,initial=box(0,0),options)=>compareOwnedEnergyCourse(initial,[raw(-10),raw(10)],[raw(-V),raw(V)],rows(r),options);
test('Exact contact, strict gap, zero speed and permanent first certificate',()=>{
 assert.equal(check([[0,0,0],[1,1,1]]).status,'inconclusive');
 const r=check([[0,0,0],[1,2,2],[2,0,0],[3,8,8]]);assert.equal(r.status,'conjunction_rejected');assert.equal(r.first.later.index,1);assert.deepEqual(r.first.gap,s(1));assert.equal(r.rows.length,5);assert.equal(r.rows.at(-1).prefixCompatible,false);
 assert.equal(check([[0,0,0],[1,0,0]],0).status,'inconclusive');assert.deepEqual(check([[0,0,0],[1,1,1]],0).first.allowedTravel,s(0));
});
test('Nonadjacent witness, original initial box, exact large-epoch gaps',()=>{
 const r=check([[1e12,0,0],[1e12+.5,-10,10],[1e12+1,2,2]]);assert.equal(r.first.earlier.kind,'original-initial-box');assert.equal(r.first.later.index,2);assert.deepEqual(r.first.elapsed,s(1));assert.deepEqual(r.first.gap,s(1));
 const q=check([[0,-1,1],[1,3,3]],1,box(-1,1));assert.deepEqual(q.first.requiredTravel,s(2));
});
test('Complete population and whole-work reservation; malformed bounded admission',()=>{
 const r=check(Array.from({length:4096},(_,i)=>[i,0,0]));assert.equal(r.rows.length,4097);assert(r.work.operations<=r.work.reservation);assert(r.work.reservation<=140000);
 assert.throws(()=>check([[0,0,0],[1,0,0]],1,box(0,0),{workLimit:1}),/reservation/);
 assert.throws(()=>check([[0,0,0],[0,0,0]]),/strictly increase/);
 assert.throws(()=>check([[0,0,0],[1,0,0]],-1));
 for(const bad of [{numerator:'0',denominator:'0'},{numerator:'0',denominator:'-1'},{numerator:0,denominator:'1'},{numerator:'1'.repeat(1251),denominator:'1'}])assert.throws(()=>check([[0,0,0],[1,0,0]],1,[bad,s(0)]));
 assert.throws(()=>check([[0,0,0],[1,0,0]],1,Array(10000).fill(s(0))),/Exactly two/);
});
const model={id:'authored',schema:'worldlaw.angular-model/v1',scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',physicalInertia:null,absoluteTorqueIdentified:false,units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},terms:[{id:'rate',coefficient:-.02,coefficientUnit:'1/s'},{id:'gravity',coefficient:-4,coefficientUnit:'rad/s²'}]};
const run={id:'authored',kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:0,source:{label:'Authored necessary-course control; not an ODE solution'},samples:Array.from({length:201},(_,i)=>({time:i/50,position:i===199?1.8:i===200?-1.8:1.4}))};
test('Public recomputation: every position overlaps yet original 199/200 rejects; source immutable',()=>{
 const before=JSON.stringify({model,run});const q=prepareInitialEnergyQuestion(model,run,{positionHalfWidth:0,rateHalfWidth:0},{angleReadingHalfWidth:.5});assert.equal(q.readingResult.separatedCount,0);const c=q.readingResult.course;assert.equal(c.status,'conjunction_rejected');assert.equal(c.first.earlier.index,199);assert.equal(c.first.later.index,200);assert.equal(c.rows.length,202);assert.equal(JSON.stringify({model,run}),before);
});
test('Source-only reopen recomputes course; survival explicitly remains inconclusive',async()=>{
 const q=prepareInitialEnergyQuestion(model,run,{positionHalfWidth:0,rateHalfWidth:0},{angleReadingHalfWidth:.5}),text=exportInitialEnergyQuestion(q);assert(!text.includes('allowedTravel'));q.readingResult.course={status:'inconclusive'};assert.equal((await reopenInitialEnergyQuestion(text,{model,run})).readingResult.course.status,'conjunction_rejected');
 const constant={...run,samples:run.samples.map(x=>({...x,position:1.4}))};const c=prepareInitialEnergyQuestion(model,constant,{positionHalfWidth:0,rateHalfWidth:0},{angleReadingHalfWidth:0}).readingResult.course;assert.equal(c.status,'inconclusive');assert.match(c.boundary,/does not establish an ODE/);
});
