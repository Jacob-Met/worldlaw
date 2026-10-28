import {replayEqualAngleReturns} from './equal-angle-returns.mjs';
import {rational,add,sub,mul,div,neg,cmp,enclosure,serial} from '../unknown-lab/chronos-exact-halfplanes.mjs';
export const RETURN_BOUNDS_SCHEMA='worldlaw.equal-angle-bounds/v1';
const copy=x=>JSON.parse(JSON.stringify(x)), insist=(ok,m)=>{if(!ok)throw Error(m);}, ZERO=rational(0),ONE=rational(1),TWO=rational(2);
function declaration(d){
 insist(d&&Number.isFinite(d.positionRadius)&&d.positionRadius>=0&&d.positionRadius<=1000,'Declare a hypothetical position-reading radius from 0 to 1000 rad.');
 insist(Number.isFinite(d.derivativeError)&&d.derivativeError>=0&&d.derivativeError<=1000,'Declare a separate derivative-model error from 0 to 1000 rad/s.');
 const maxWork=d.maxWork??4000000;insist(Number.isSafeInteger(maxWork)&&maxWork>=0&&maxWork<=4000000,'Declare at most 4000000 additional exact arithmetic operations.');
 return {positionRadius:d.positionRadius,derivativeError:d.derivativeError,maxWork};
}
function arithmetic(work){
 const tick=()=>{insist(work.actual<work.reserved&&work.actual<work.limit,'Reserved exact arithmetic work exhausted.');work.actual++;};
 const wrap=f=>(...args)=>{tick();return f(...args);};
 return {q:wrap(rational),add:wrap(add),sub:wrap(sub),mul:wrap(mul),div:wrap(div),cmp:wrap(cmp),neg:wrap(neg)};
}
function exactWindow(samples,index,size,a){
 const half=(size-1)/2,s=samples.slice(index-half,index+half+1);insist(s.length===size&&index>=half&&index+half<samples.length,'Complete original centered window unavailable.');
 const center=a.q(samples[index].time),offsets=s.map(x=>a.sub(a.q(x.time),center));
 const abs=x=>a.cmp(x,ZERO)<0?a.neg(x):x;
 const scale=offsets.map(abs).reduce((x,y)=>a.cmp(x,y)>0?x:y,ZERO);insist(a.cmp(scale,ZERO)>0,'Exact window has zero duration.');
 const t=offsets.map(x=>a.div(x,scale)),columns=t.map(x=>[ONE,x,a.mul(x,x),a.mul(a.mul(x,x),x)]);
 const matrix=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>columns.reduce((sum,row)=>a.add(sum,a.mul(row[i],row[j])),ZERO)));
 const rhs=[ZERO,a.div(ONE,scale),ZERO,ZERO];const augmented=matrix.map((row,i)=>[...row,rhs[i]]);
 for(let col=0;col<4;col++){
  const pivot=augmented.findIndex((row,i)=>i>=col&&a.cmp(row[col],ZERO)!==0);insist(pivot>=col,'Exact local polynomial is rank deficient.');
  [augmented[col],augmented[pivot]]=[augmented[pivot],augmented[col]];const divisor=augmented[col][col];augmented[col]=augmented[col].map(x=>a.div(x,divisor));
  for(let i=0;i<4;i++)if(i!==col){const factor=augmented[i][col];augmented[i]=augmented[i].map((x,j)=>a.sub(x,a.mul(factor,augmented[col][j])));}
 }
 const dual=augmented.map(row=>row[4]),weights=columns.map(row=>row.reduce((sum,x,i)=>a.add(sum,a.mul(x,dual[i])),ZERO));
 // Exact polynomial reproduction independently checks the assembled functional.
 for(let degree=0;degree<4;degree++){
  const value=weights.reduce((sum,w,i)=>a.add(sum,a.mul(w,columns[i][degree])),ZERO);
  insist(a.cmp(value,degree===1?a.div(ONE,scale):ZERO)===0,'Exact derivative reproduction failed.');
 }
 return {rate:weights.reduce((sum,w,i)=>a.add(sum,a.mul(w,a.q(s[i].position))),ZERO),gain:weights.reduce((sum,w)=>a.add(sum,abs(w)),ZERO)};
}
const shown=x=>({...enclosure(x),exact:serial(x)});
function squareRange(low,high,a){const l=a.mul(low,low),h=a.mul(high,high);return {low:a.cmp(low,ZERO)<=0&&a.cmp(high,ZERO)>=0?ZERO:(a.cmp(l,h)<0?l:h),high:a.cmp(l,h)>0?l:h};}
/** Raw receiving source is replayed; these are conditional observation/model boxes. */
export function inspectReturnBounds(returnInputs,rawDeclaration){
 const d=declaration(rawDeclaration),original=replayEqualAngleReturns(returnInputs),size=original.windowSize,runs=original.original.investigation.inputs.bundle.challengeRuns;
 const model=original.original.investigation.inputs.restoringModel,terms=model.terms,domain=model.domain?.position??null;
 const windows=new Map();for(const row of original.rows)if(row.status==='compared')for(const index of [row.first,row.last])windows.set(row.runId+'\0'+index,{runId:row.runId,index});
 const reserved=windows.size*(size*200+5000)+original.rows.length*(400+terms.length*100);
 const work={reserved,actual:0,limit:d.maxWork,windows:windows.size,rows:original.rows.length,available:reserved<=d.maxWork&&windows.size<=512&&original.rows.length<=2048,scope:'Complete additional exact calculation reserved before execution. Existing raw source replay has its own bounds; at most512 unique windows and2048 retained rows can be calculated.'};
 const a=arithmetic(work),cache=new Map(),rows=[];
 if(work.available)for(const [key,x]of windows){try{cache.set(key,exactWindow(runs.find(r=>r.id===x.runId).samples,x.index,size,a));}catch(error){cache.set(key,{reason:error.message});}}
 for(const row of original.rows){
  const out={runId:row.runId,cycleIndex:row.cycleIndex,first:row.first??null,last:row.last??null,reportedPosition:row.position??null,status:'refused',maintainedKineticLoss:row.kineticLoss??null};
  try{
   insist(row.status==='compared',row.reason);insist(work.available,'Complete original population exceeds the additional exact work/capacity reservation.');
   const first=cache.get(row.runId+'\0'+row.first),last=cache.get(row.runId+'\0'+row.last);insist(!first.reason,first.reason);insist(!last.reason,last.reason);
   const abs=x=>a.cmp(x,ZERO)<0?a.neg(x):x,e=a.q(d.positionRadius),eta=a.q(d.derivativeError),q=a.q(row.position),qmax=a.add(abs(q),e);
   let slope=ZERO;for(const term of terms){const c=abs(a.q(term.coefficient));let feature;
    if(term.id==='gravity'||term.id==='bias')feature=ONE;else if(term.id==='spring')feature=qmax;else if(term.id==='cubic')feature=a.mul(a.mul(qmax,qmax),qmax);else throw Error('Frozen potential term lacks a supported slope bound: '+term.id);
    slope=a.add(slope,a.mul(c,feature));
   }
   const firstRadius=a.add(a.mul(e,first.gain),eta),lastRadius=a.add(a.mul(e,last.gain),eta);
   const x=squareRange(a.sub(first.rate,firstRadius),a.add(first.rate,firstRadius),a),y=squareRange(a.sub(last.rate,lastRadius),a.add(last.rate,lastRadius),a);
   const potentialRadius=a.mul(a.mul(TWO,e),slope),low=a.sub(a.div(a.sub(x.low,y.high),TWO),potentialRadius),high=a.add(a.div(a.sub(x.high,y.low),TWO),potentialRadius);
   const nominal=a.div(a.sub(a.mul(first.rate,first.rate),a.mul(last.rate,last.rate)),TWO);
   const endpointOutside=domain&&Number.isFinite(domain.min)&&Number.isFinite(domain.max)?a.cmp(a.sub(q,e),a.q(domain.min))<0||a.cmp(a.add(q,e),a.q(domain.max))>0:null;
   Object.assign(out,{status:'bounded',classification:a.cmp(high,ZERO)<0?'negative-throughout-box':a.cmp(low,ZERO)>=0?'nonnegative-throughout-box':'unresolved-by-outer-box',lossLower:shown(low),lossUpper:shown(high),exactLocalKineticLoss:shown(nominal),nominalSignDiffers:(a.cmp(nominal,ZERO)<0)!==(row.kineticLoss<0),firstRate:shown(first.rate),lastRate:shown(last.rate),firstRateRadius:shown(firstRadius),lastRateRadius:shown(lastRadius),firstReadingGain:shown(first.gain),lastReadingGain:shown(last.gain),potentialChangeRadius:shown(potentialRadius),endpointBoxOutsideTrainingDomain:endpointOutside});
  }catch(error){out.reason=error.message;}
  rows.push(out);
 }
 return {schema:'worldlaw.equal-angle-bounds-report/v1',original,rows,declaration:d,work,frozenPotential:copy(model),trainingPositionDomain:copy(domain),inputs:{schema:RETURN_BOUNDS_SCHEMA,returnInputs:copy(original.inputs),declaration:d},qualification:'Hypothetical position boxes bound the exact local cubic least-squares functional of supplied binary64 times and positions, not the physical derivative. Physical-rate interpretation additionally assumes the separately declared derivative-model error. Potential change is bounded only for this frozen restoring family. Shared sample dependencies are overbounded; unresolved is not a constructive feasible trajectory. CSV resolution is not a calibrated error bound; no probability, physical passivity or mechanism identification is claimed. Original rates and any exact-versus-floating near-zero sign difference remain visible.'};
}
export function replayReturnBounds(inputs){insist(inputs?.schema===RETURN_BOUNDS_SCHEMA,'Expected raw return-bound source notebook.');return inspectReturnBounds(inputs.returnInputs,inputs.declaration);}
