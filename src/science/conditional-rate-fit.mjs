import {evaluate,predict} from './torque-discovery.mjs';
import {fitLinearColumns} from './linear-fit.mjs';
import {investigateRateDissipation} from './rate-dissipation.mjs';
import {rational,sub,cmp,enclosure} from '../unknown-lab/chronos-exact-halfplanes.mjs';
const rateIds=['coulomb','rate','quadratic'];
const MAX_WORK=20000000,MAX_ROUNDS=24;

// All finite constraints are homogeneous quadratic values at distinct speeds.
// One active root leaves two coefficients; two roots leave one; three imply zero.
// Each face uses the maintained QR fitter rather than normal equations.
function finiteFit(columns,target,cuts,work){
 const bases=[[[1,0,0],[0,1,0],[0,0,1]],...cuts.map(r=>[[-r,1,0],[0,-r,1]]),[]];
 for(let i=0;i<cuts.length;i++)for(let j=0;j<i;j++)bases.push([[cuts[i]*cuts[j],-cuts[i]-cuts[j],1]]);
 let best=null;
 for(const basis of bases){
  work.count+=target.length*(basis.length*3+3);
  if(work.count>MAX_WORK)throw Error('Conditional fit work capacity exhausted; no partial revision returned.');
  const reduced=basis.map(b=>target.map((_,i)=>b.reduce((v,c,k)=>v+c*columns[k][i],0)));
  const fit=fitLinearColumns(reduced,target);if(!fit)continue;
  const coefficients=[0,1,2].map(k=>basis.reduce((v,b,i)=>v+b[k]*fit.coefficients[i],0));
  if(!coefficients.every(Number.isFinite))continue;
  if(cuts.some(r=>coefficients[0]+r*(coefficients[1]+r*coefficients[2])>1e-10))continue;
  const error=Math.hypot(...target.map((v,i)=>v-coefficients.reduce((sum,c,k)=>sum+c*columns[k][i],0)));
  if(Number.isFinite(error)&&(!best||error<best.error))best={coefficients,error};
 }
 if(!best)throw Error('No numerically admitted conditional candidate.');
 return best;
}

/** Training-only conditional revision. Non-rate coefficients remain fixed.
 * Numerical constrained least squares; exact final polynomial feasibility is
 * checked separately. Neither global optimality nor physical passivity is certified.
 */
export function conditionalRateFit(model,training,maximumSpeed){
 predict(model,{command:0,position:0,rate:0});
 if(!Number.isFinite(maximumSpeed)||maximumSpeed<=0||maximumSpeed>1e6)
  throw Error('Declare a positive finite maximum speed at most 1000000 rad/s.');
 const before=evaluate(model,training);
 if(before.count<8)throw Error('Conditional revision needs at least eight training rows.');
 const fixed={...model,terms:model.terms.filter(t=>!rateIds.includes(t.id)).map(t=>({...t}))};
 const normalized=training.map(row=>row.rate/maximumSpeed);
 if(!normalized.every(Number.isFinite))throw Error('Speed normalization overflowed.');
 const columns=[training.map(row=>Math.sign(row.rate)),normalized,normalized.map(v=>v*Math.abs(v))];
 const target=training.map(row=>row.jointTorque-predict(fixed,row));
 if(!columns.flat().every(Number.isFinite)||!target.every(Number.isFinite))throw Error('Conditional design overflowed.');
 const unconstrained=fitLinearColumns(columns,target);
 if(!unconstrained||unconstrained.conditionEstimate>1e6)
  throw Error('Rate response is rank deficient or too weakly conditioned for this revision.');
 const cuts=[0,1],work={count:0};let fit,rounds=0,converged=false;
 for(;rounds<MAX_ROUNDS;rounds++){
  fit=finiteFit(columns,target,cuts,work);
  const [f,d,q]=fit.coefficients,points=[0,1];
  if(q<0){const r=-d/(2*q);if(r>0&&r<1)points.push(r);}
  const peak=points.map(r=>({r,value:f+r*(d+r*q)})).sort((a,b)=>b.value-a.value)[0];
  if(peak.value<=1e-10){converged=true;rounds++;break;}
  if(cuts.includes(peak.r))throw Error('Conditional refinement stalled; no partial revision returned.');
  cuts.push(peak.r);
 }
 if(!converged)throw Error('Conditional refinement capacity exhausted; no partial revision returned.');
 const c=[fit.coefficients[0],fit.coefficients[1]/maximumSpeed,(fit.coefficients[2]/maximumSpeed)/maximumSpeed];
 const revised={schema:'worldlaw.torque-model/v1',id:model.id+' / conditional nonpositive rate power',
  terms:[...fixed.terms,...rateIds.map((id,i)=>({id,coefficient:c[i]}))],units:model.units,domain:model.domain};
 let screen=investigateRateDissipation(revised,maximumSpeed),correction=0;
 if(screen.witness){
  const peak=screen.maximumCandidates.map(x=>[BigInt(x.factor.numerator),BigInt(x.factor.denominator)]).reduce((a,b)=>cmp(a,b)>0?a:b);
  const term=revised.terms.find(t=>t.id==='coulomb'),old=term.coefficient;
  term.coefficient=enclosure(sub(rational(old),peak)).lower;correction=old-term.coefficient;
  screen=investigateRateDissipation(revised,maximumSpeed);
 }
 if(screen.witness)throw Error('Exact final feasibility check refused the revision.');
 return {schema:'worldlaw.conditional-rate-fit/v1',model:revised,maximumSpeed,screen,
  training:{original:before,revised:evaluate(revised,training)},
  diagnostics:{rounds,work:work.count,workLimit:MAX_WORK,conditionEstimate:unconstrained.conditionEstimate,coulombCorrection:correction},
  interpretation:'Conditional training-only revision with original non-rate coefficients fixed. Three rate coefficients were numerically fitted under an explicit nonpositive-power assumption over the declared speed interval. The final supplied binary64 polynomial passes an exact real-arithmetic sign check; numerical optimality, rounded simulation arithmetic, coefficient uncertainty and physical passivity are not certified. Compare every held-out prediction with the original law: a false assumption can worsen them.'};
}
