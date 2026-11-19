// For y(t)=a+b*t+A*exp(-rate*t), the middle reading's deficit below
// its neighbours' chord is A*rate^2 times the integral of a positive
// triangular kernel against exp(-rate*t). The constant and slope cancel.
const slices = 128;
const depthLimit = 12;
const relativeAllowance = 1e-10;

function makeChord(rows, i, origin, error) {
  const [a,b,c] = rows.slice(i,i+3);
  const left = b.wait-a.wait, right = c.wait-b.wait;
  const leftWeight = right/(left+right), rightWeight = left/(left+right);
  const value = leftWeight*(a.difference-b.difference) + rightWeight*(c.difference-b.difference);
  // Include uncertainty in all three measured contrasts and finite arithmetic
  // in the recorded-time weights. The recorded timestamps are the model inputs.
  const magnitude = Math.max(1,Math.abs(a.difference),Math.abs(b.difference),Math.abs(c.difference));
  const roundoff = 256*Number.EPSILON*magnitude*(1+60/Math.min(left,right));
  return {start:a.wait-origin, midpoint:b.wait-origin, left, right, leftWeight, rightWeight,
    lower:value-2*error-roundoff, upper:value+2*error+roundoff};
}

function kernelBounds(chord, rate) {
  // Each exact tent-cell area is positive. Endpoint values of the decreasing
  // exponential bound its integral on that cell, without subtracting nearly
  // equal exponentials at small rates.
  let lower=0, upper=0;
  for (const rising of [true,false]) {
    const step=(rising?chord.left:chord.right)/slices;
    const weight=rising?chord.leftWeight:chord.rightWeight;
    const ratio=Math.exp(-rate*step);
    let density=Math.exp(-rate*(rising?chord.start:chord.midpoint));
    let sum=0;
    for(let i=0;i<slices;i++){
      sum += density*(rising?i+0.5:slices-i-0.5);
      density *= ratio;
    }
    const high=sum*weight*step*step;
    upper+=high;
    lower+=high*ratio;
  }
  return [Math.max(0,lower*(1-relativeAllowance)-1e-280),upper*(1+relativeAllowance)+1e-280];
}

export function inspectRecordedAffineReads(rows,error) {
  if(!Array.isArray(rows)||rows.length>5||!Number.isFinite(error)||error<0||error>1e6){
    throw new RangeError('Use up to five readings with a bounded absolute error');
  }
  for (const [i,row] of rows.entries()) {
    if(!Number.isFinite(row?.wait)||row.wait<0||row.wait>60||
       !Number.isFinite(row.difference)||Math.abs(row.difference)>1e6||
       (i>0&&row.wait-rows[i-1].wait<0.05)){
      throw new RangeError('Use finite recorded waits from 0 to 60 seconds, at least 0.05 seconds apart');
    }
  }
  if(rows.length<5)return {status:'unresolved',reason:'await-training'};
  const chords=[0,1,2].map(i=>makeChord(rows,i,rows[0].wait,error));
  if(chords.some(c=>c.lower<=0))return {status:'unresolved',reason:'chord-within-error'};

  // Bound the entire high-rate tail using just the first rising half-tent
  // and the full third tent. An unbounded A or affine slope cannot rescue
  // a rate once this ratio falls below the observed lower ratio.
  const first=chords[0], last=chords[2];
  const cutoffTime=first.left/2;
  const firstMass=first.leftWeight*cutoffTime**2/2;
  const lastMass=last.left*last.right/2;
  const observedRatio=last.lower/first.upper;
  let ceilingRate=1/(rows[4].wait-rows[0].wait);
  while(lastMass/firstMass*Math.exp(-ceilingRate*(last.start-cutoffTime))>=observedRatio/2){
    ceilingRate*=2;
    if(ceilingRate*(rows[4].wait-rows[0].wait)>600)return {status:'unresolved',reason:'rate-resolution'};
  }

  const at=rate=>chords.map(c=>kernelBounds(c,rate));
  let rejectedBands=0;
  function excluded(lo,hi,atLo,atHi,depth){
    // Each I_j is decreasing in rate, so these endpoint enclosures apply
    // over the whole band. All three chords must share one scale A*rate^2.
    let minScale=0,maxScale=Infinity;
    for(let i=0;i<3;i++){
      minScale=Math.max(minScale,chords[i].lower/atLo[i][1]);
      maxScale=Math.min(maxScale,chords[i].upper/atHi[i][0]);
    }
    if(minScale>maxScale*(1+relativeAllowance)){rejectedBands++;return true;}
    if(depth===depthLimit)return false;
    const mid=(lo+hi)/2, atMid=at(mid);
    return excluded(lo,mid,atLo,atMid,depth+1)&&excluded(mid,hi,atMid,atHi,depth+1);
  }
  if(!excluded(0,ceilingRate,at(0),at(ceilingRate),0))return {status:'unresolved',reason:'compatible-or-unresolved-band'};
  return {status:'recorded-affine-exclusion',rejectedBands,ceilingRate};
}
