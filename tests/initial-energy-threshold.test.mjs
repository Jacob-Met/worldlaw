import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareInitialEnergyReadingQuestion as prepare} from '../src/trajectory/initial-energy-readings.mjs';
import {exportInitialEnergyQuestion,reopenInitialEnergyQuestion} from '../src/trajectory/initial-energy-receipt.mjs';
import {formatReadingThreshold} from '../src/trajectory/initial-energy-panel.mjs';
const model={id:'threshold-authored',schema:'worldlaw.angular-model/v1',scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',physicalInertia:null,absoluteTorqueIdentified:false,units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},terms:[{id:'rate',coefficient:-.02,coefficientUnit:'1/s'},{id:'gravity',coefficient:-4,coefficientUnit:'rad/s²'}]};
const widths={positionHalfWidth:0,rateHalfWidth:0};
const course=(positions,initialRate=0)=>({id:'original',kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate,source:{label:'Authored threshold controls'},samples:positions.map((position,i)=>({time:100+i/32,position}))});
const question=(run,radius=0,w=widths)=>prepare(model,run,w,{angleReadingHalfWidth:radius});
test('Exact full-row maximum retains every tied original identity including last page',()=>{
 const positions=Array(201).fill(0);positions[0]=1;positions[2]=1.25;positions[199]=1.5;positions[200]=-1.5;
 const run=course(positions),q=question(run),t=q.readingResult.overlapThreshold;
 assert.deepEqual(t.exact,{numerator:'1',denominator:'2'});assert.deepEqual(t.attainingRows,[199,200].map(index=>({index,...run.samples[index]})));
 assert.equal(question(run,.5).readingResult.separatedCount,0);
 assert.equal(question(run,.5-Number.EPSILON).readingResult.separatedCount,2);
 assert.deepEqual(question(run,.75).readingResult.overlapThreshold,t);assert.deepEqual(q.source.options,widths);
});
test('Zero retains complete ties without inventing rejected readings; complete work is bounded',()=>{
 const run=course(Array(4096).fill(1)),q=question(run),r=q.readingResult,t=r.overlapThreshold;
 assert.equal(t.zero,true);assert.equal(r.separatedCount,0);assert.equal(t.attainingRows.length,4096);assert.equal(t.attainingRows.at(-1).index,4095);
 assert.deepEqual(t.exact,{numerator:'0',denominator:'1'});assert.equal(r.work.maxThresholdSubtractions,4096);assert.equal(r.work.maxThresholdRowComparisons,12288);assert.equal(r.work.thresholdDirectedProjections,1);
 assert.throws(()=>question(course(Array(4097).fill(1))));
});
test('Nonbinary threshold encloses exact distance; diagnostic over100 does not admit larger declarations',()=>{
 const q=question(course([0,2],1)),t=q.readingResult.overlapThreshold,upper=BigInt(q.result.positionRaw[1]),d=1n<<80n;
 assert.equal(BigInt(t.exact.numerator)*d,(2n*d-upper)*BigInt(t.exact.denominator));
 const {lower:lo,upper:hi}=t.binary64Enclosure;assert(lo<=hi);assert.equal(question(course([0,2],1),hi).readingResult.separatedCount,0);
 const large=question(course([1,102]),100).readingResult;assert.equal(large.overlapThreshold.withinDeclaredRadiusLimit,false);assert.equal(large.separatedCount,1);assert.throws(()=>question(course([1,102]),101));
 assert.equal(question(course([1,2]),0,{...widths,rateHalfWidth:10}).readingResult.status,'unavailable');
});
test('Source-only replay derives threshold afresh and does not extend source schema',async()=>{
 const run=course([1,1.5,-1.5]),q=question(run,.25),raw=JSON.parse(exportInitialEnergyQuestion(q));
 assert.deepEqual(Object.keys(raw).sort(),['model','options','readingComparison','run','schema'].sort());
 raw.result={overlapThreshold:{exact:{numerator:'0',denominator:'1'}}};
 assert.deepEqual(await reopenInitialEnergyQuestion(JSON.stringify(raw),{model,run}),q);
 assert.equal(q.source.readingComparison.angleReadingHalfWidth,.25);
});
// Independent decimal parser: compare emitted text by integer cross-products, not Number rounding.
function decimal(text){const [mantissa,exponent='0']=text.split('e'),digits=mantissa.replace('.',''),places=(mantissa.split('.')[1]||'').length,power=Number(exponent)-places;return power>=0?[BigInt(digits)*10n**BigInt(power),1n]:[BigInt(digits),10n**BigInt(-power)];}
test('Directed decimal display encloses exact rationals including tiny positive thresholds',()=>{
 for(const [n,d] of [[0n,1n],[1n,3n],[1n,2n],[1n,1n<<1074n],[999999999999999999n,100000000000000000n],[10000001n,3n],[903470946054995998740717n,604462909807314587353088n]]){
  const display=formatReadingThreshold({numerator:String(n),denominator:String(d)}),[ln,ld]=decimal(display.lower),[un,ud]=decimal(display.upper);
  assert(ln*d<=n*ld);assert(un*d>=n*ud);if(n>0n)assert(ln>0n);
 }
 assert.throws(()=>formatReadingThreshold({numerator:'-1',denominator:'2'}));assert.throws(()=>formatReadingThreshold({numerator:'1',denominator:'0'}));
});
