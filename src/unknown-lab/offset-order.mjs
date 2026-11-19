import {inspectRelaxationReads,planRelaxationReads} from './relaxation-order.mjs';

// Subtracting adjacent samples cancels a constant offset. A positive mode
// retains its rate and changes its amplitude from A to A(1-r^s).
const maxReading=1e6;
const arithmeticError=8*Number.EPSILON*maxReading;
export function planOffsetReads(domain){
  const validated=planRelaxationReads(domain);
  const [fastMin,fastMax]=domain.fast,[slowMin,slowMax]=domain.slow;
  const [minAmp,maxAmp]=domain.amplitude;
  const differenceError=2*domain.error+arithmeticError;
  const candidates=validated.candidates.map(({stride})=>{
    const fast=fastMax**stride,slow=slowMin**stride;
    const minimumProduct=minAmp**2*(1-fast)*(1-slowMax**stride);
    const determinant=minimumProduct*Math.max(0,slow-fast)**2;
    const largestFast=maxAmp*(1-fastMin**stride),largestSlow=maxAmp*(1-slowMin**stride);
    const noisePenalty=2*differenceError*(largestFast*(1+fast)**2+largestSlow*(1+slowMax**stride)**2);
    const tolerance=256*Number.EPSILON*Math.max(1,(2*maxAmp+2*differenceError)**2);
    return {stride,margin:determinant-noisePenalty-tolerance};
  });
  const best=candidates.reduce((a,b)=>b.margin>a.margin?b:a);
  if(best.margin<=0)return {status:'unresolved',candidates};
  return {status:'separating-plan',waits:[0,best.stride,2*best.stride,3*best.stride],candidates};
}

export function inspectOffsetReads(rows,error){
  if(!Number.isFinite(error)||error<0||error>1e6)throw new RangeError('Invalid per-reading absolute error');
  if(!Array.isArray(rows)||rows.length>4)throw new RangeError('Use at most four readings');
  const stride=rows.length>1?rows[1].wait:1;
  if(!Number.isSafeInteger(stride)||stride<1)throw new RangeError('Invalid stride');
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(row.wait!==i*stride||!Number.isFinite(row.difference)||Math.abs(row.difference)>maxReading){
      throw new RangeError('Use finite bounded readings at waits 0, s, 2s, 3s');
    }
  }
  if(rows.length<4||2*error+arithmeticError>1e6)return {status:'unresolved'};
  const contrasts=rows.slice(0,3).map((row,i)=>({wait:row.wait,difference:row.difference-rows[i+1].difference}));
  const result=inspectRelaxationReads(contrasts,2*error+arithmeticError);
  return {...result,status:result.status==='positive-curvature'?'offset-invariant-curvature':'unresolved',contrasts};
}
