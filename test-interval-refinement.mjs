import assert from 'node:assert/strict';
import {account,zeroRef} from './probe-refinement-fixture.mjs';
import {createReferenceSequence} from './src/unknown-lab/reference-sequence.mjs';
import {screenIntervalRefinement as score,analyzeIntervalRefinement as analyze,validateIntervalRefinement as validate,exportIntervalRefinement as save,importIntervalRefinement as open,INTERVAL_REFINEMENT_SCHEMA as schema} from './src/unknown-lab/reference-interval-refinement.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const controls=[
 ['point gain',[[[0,0],[2,0]]],[1],[1,0],[1,0],0,.1,.2],
 ['finite gain',[[[0,0],[2,0]]],[1],[1,0],[1,0],.1,.1,6/11],
 ['negative gain',[[[-2,0],[0,0]]],[-1],[1,0],[1,0],.1,.1,6/11],
 ['contains zero',[[[0,0],[2,0]]],[1],[1,0],[1,0],1,0,2],
 ['distinct latent references',[[[1,0],[2,0]]],[1],[1,0],[1,0],.5,0,1],
 ['point cannot separate latent values',[[[1,0],[2,0]]],[1],[1,0],[1,0],0,0,0],
 ['signed disconnected',[[[-1,0]],[[1,0]]],[-1,1],[0,0],[1,0],.1,0,2],
 ['singleton',[[[1,2]]],[1],[1,1],[1,1],.1,.1,0],
 ['orthogonal amplitude',[[[0,0],[2,0],[2,1],[0,1]]],[1],[1,0],[0,1],.1,0,1],
 ['zero gain division branch',[[[0,1],[0,2]]],[1],[1,0],[0,1],.1,0,1],
 ['correlated',[[[0,0],[2,1],[2,2]]],[1],[0,1],[1,0],0,.1,1.2]
];
for(const [name,parts,signs,u,v,rho,e,width]of controls){const r=score(parts,signs,u,v,rho,e);assert.equal(r.status,'computed',name+JSON.stringify(r));near(r.worstRemainingWidth,width);assert(r.work.checkedCandidates<=r.work.reservedCandidateBound);assert.equal(r.pairs.length,parts.length**2);r.witness.referenceWitnesses.forEach((ref,i)=>{assert(ref>=u[0]-rho&&ref<=u[0]+rho);const[g,A]=i?r.witness.right:r.witness.left;assert(Math.abs(g*ref+A*u[1]-r.witness.commonMainReading)<=e+r.numericalGuard);});}
const uncertain=score([[[0,0],[1,1],[2,2+Number.EPSILON*2]]],[1],[1,1],[1,0],.1,0);assert.equal(uncertain.status,'numerically-unresolved');
assert.equal(score([[[0,0],[2,0],[2,1],[0,1]]],[1],[1,1],[1,0],.1,.1,{workLimit:1}).status,'numerically-unresolved');
assert.throws(()=>score([[[1,0]]],[-1],[1,0],[1,0],.1,0));assert.throws(()=>score([[[0,0]]],[1],[1,0],[1,0],-1,0));
const raw={schema,account:createReferenceSequence(zeroRef),target:{duration:2,reference:1},offers:[0,.1,1].map((rho,i)=>({id:'offer-'+i,duration:2,reference:1,referenceHalfWidth:rho,mainHalfWidth:.0001})),conditionalReferenceInterval:true};
const r=analyze(raw);assert.equal(r.recommendation,'offer-0');for(const c of r.comparisons){assert.equal(c.status,'computed',JSON.stringify(c));assert.equal(c.witness.sourceConstraintChecks.length,6);}near(r.comparisons[0].worstRemainingWidth,.0002);near(r.comparisons[1].worstRemainingWidth,.36381818810102434);assert(r.comparisons[2].worstRemainingWidth>2);
const after=analyze({...raw,account});assert.equal(after.recommendation,null);assert(after.comparisons.every(c=>c.status==='computed'&&c.worstRemainingWidth<1e-7&&c.witness.sourceConstraintChecks.length===8));
const frozen=validate(raw);assert(Object.isFrozen(frozen)&&Object.isFrozen(frozen.account)&&Object.isFrozen(frozen.offers[0]));assert.deepEqual(open(save(raw)),frozen);assert.throws(()=>{frozen.offers[0].referenceHalfWidth=4;});
for(const patch of[{derived:r},{offers:[]},{conditionalReferenceInterval:false},{offers:[{...raw.offers[0],referenceHalfWidth:-1}]},{offers:[{...raw.offers[0],reference:1e6,referenceHalfWidth:1}]},{offers:Array(33).fill(raw.offers[0])}])assert.throws(()=>validate({...raw,...patch}));assert.throws(()=>open(' '.repeat(4000001)));
console.log('PASS 11 analytic controls; latent-reference witnesses incl g=0; original-source rechecks; rank/work refusal; retained actuals; immutable bounded source-only replay.');
