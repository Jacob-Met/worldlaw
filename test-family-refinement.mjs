import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {screenReferenceProducts as score,reserveReferenceProductWork as reserve} from './src/unknown-lab/reference-product-faces.mjs';
import {analyzeFamilyRefinement as analyze,exportFamilyRefinement as save,importFamilyRefinement as open,FAMILY_REFINEMENT_SCHEMA as schema} from './src/unknown-lab/reference-family-refinement.mjs';
import {analyzeIntervalRefinement,INTERVAL_REFINEMENT_SCHEMA} from './src/unknown-lab/reference-interval-refinement.mjs';
import {createReferenceSequence} from './src/unknown-lab/reference-sequence.mjs';
import {zeroRef} from './probe-refinement-fixture.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const cases=[
 {name:'same future different target',p:[[[0,1]],[[0,1]]],s:[1,1],u:[[0,1],[0,1]],v:[[0,1],[0,2]],rho:0,e:0,w:1},
 {name:'separated future singletons',p:[[[0,1]],[[0,1]]],s:[1,1],u:[[0,1],[0,2]],v:[[0,1],[0,2]],rho:0,e:0,w:0},
 {name:'nested A zero',p:[[[1,0]],[[1,0]]],s:[1,1],u:[[1,0],[1,1]],v:[[2,0],[2,3]],rho:.1,e:.1,w:0},
 {name:'zero gain branch',p:[[[0,1]],[[0,2]]],s:[1,1],u:[[1,0],[1,0]],v:[[1,1],[1,1]],rho:.1,e:0,w:1},
 {name:'closed touching',p:[[[0,1]],[[0,1]]],s:[1,1],u:[[1,1],[1,2]],v:[[1,1],[1,2]],rho:0,e:.5,w:1},
 {name:'disconnected signs',p:[[[-1,0]],[[1,0]]],s:[-1,1],u:[[0,0],[0,0]],v:[[1,0],[1,0]],rho:.1,e:0,w:2}
];
for(const c of cases){const r=score(c.p,c.s,c.u,c.v,c.rho,c.e,{modelIds:['artifact-only','additional']});assert.equal(r.status,'computed',c.name);near(r.worstRemainingWidth,c.w);assert.equal(r.pairs.length,4);for(let i=0;i<2;i++){const k=i?r.witness.rightComponent:r.witness.leftComponent,[g,A]=i?r.witness.right:r.witness.left,ref=r.witness.referenceWitnesses[i];assert(ref>=c.u[k][0]-c.rho-r.numericalGuard&&ref<=c.u[k][0]+c.rho+r.numericalGuard);assert(Math.abs(g*ref+A*c.u[k][1]-r.witness.commonMainReading)<=c.e+r.numericalGuard);}}
const singleton=Array.from({length:26},(_,i)=>[[0,i/26]]);assert.equal(reserve(singleton,Array(26).fill(1),32).total,21632);assert.throws(()=>reserve(Array(26).fill([[0,0],[1,0],[1,1],[0,1]]),Array(26).fill(1),32),/no offer was scored/);assert.throws(()=>reserve(singleton,Array(26).fill(1),32,{limit:21631}));
assert.equal(score([[[0,0],[1,1],[2,2+Number.EPSILON*2]]],[1],[[1,1]],[[1,0]],.1,0).status,'numerically-unresolved');
const fixture=JSON.parse(readFileSync(new URL('./family-source-control.json',import.meta.url))),raw={schema,scope:'all-retained-families',account:createReferenceSequence(fixture.input),target:fixture.target,conditionalReferenceInterval:true,offers:fixture.offers.map(o=>({id:o.id,duration:o.duration,reference:0,referenceHalfWidth:.001,mainHalfWidth:.01}))},r=analyze(raw);
assert.equal(r.models.length,3);assert.equal(r.work.total,15885);assert.equal(r.recommendation,'t5');const expected=[.5091069608131307,.36182155354474127,.5091069608131307,.040696407606082535,.028533014468101484];r.comparisons.forEach((c,i)=>{assert.equal(c.status,'computed');near(c.worstRemainingWidth,expected[i]);assert.equal(c.witness.sourceConstraintChecks.length,6);assert(c.witness.leftFamily.modelId&&c.witness.rightFamily.modelId);});assert.notEqual(r.comparisons[0].witness.leftFamily.modelId,r.comparisons[0].witness.rightFamily.modelId);
assert.deepEqual(open(save(raw)),r.source);assert(Object.isFrozen(r.source.account)&&Object.isFrozen(r.source.offers));for(const patch of[{scope:'one'},{derived:r},{offers:[]},{conditionalReferenceInterval:false},{account:{...raw.account,derived:[]}}])assert.throws(()=>analyze({...raw,...patch}));
const one={...raw,account:createReferenceSequence(zeroRef),target:{duration:2,reference:1},offers:[{id:'same',duration:2,reference:1,referenceHalfWidth:.1,mainHalfWidth:.0001}]};const {scope,...oldRaw}=one;const old=analyzeIntervalRefinement({...oldRaw,schema:INTERVAL_REFINEMENT_SCHEMA}),single=analyze(one);near(single.comparisons[0].worstRemainingWidth,old.comparisons[0].worstRemainingWidth);assert.deepEqual(single.comparisons[0].witness.left,old.comparisons[0].witness.left);assert.deepEqual(single.comparisons[0].witness.right,old.comparisons[0].witness.right);
console.log('PASS family controls');
