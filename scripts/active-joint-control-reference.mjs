/** Frozen exhaustive reference, written before the production joint planner.
 * Independent rational arithmetic, forward impulse simulation, every minimal
 * row dependency, every optional schedule and every signed-tuple LP vertex.
 * This is a reference algorithm, not a previous shipped continuous solver.
 */
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b)[a,b]=[b,a%b];return a||1n;};
const rational=(n,d=1n)=>{if(d===0n)throw Error('zero divisor');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return [n/g,d/g];};
const read=x=>{const p=String(x).split('/');return rational(BigInt(p[0]),BigInt(p[1]??1));};
const zero=()=>rational(0n),one=()=>rational(1n);
const plus=(a,b)=>rational(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
const minus=(a,b)=>rational(a[0]*b[1]-b[0]*a[1],a[1]*b[1]);
const times=(a,b)=>rational(a[0]*b[0],a[1]*b[1]);
const over=(a,b)=>rational(a[0]*b[1],a[1]*b[0]);
const negative=a=>[-a[0],a[1]];
const compare=(a,b)=>{const n=a[0]*b[1]-b[0]*a[1];return n<0n?-1:n>0n?1:0;};
const string=a=>a[1]===1n?String(a[0]):a.join('/');
const dot=(a,b)=>a.reduce((s,x,i)=>plus(s,times(x,b[i])),zero());
const zeros=n=>Array.from({length:n},zero);
function* combinations(n,k,start=0,prefix=[]){
  if(k===0){yield prefix;return;}
  for(let i=start;i<=n-k;i++)yield* combinations(n,k-1,i+1,[...prefix,i]);
}
function echelon(input){
  const m=input.map(row=>row.slice()),pivot=[];
  for(let col=0,row=0;col<(m[0]?.length??0)&&row<m.length;col++){
    const p=m.findIndex((r,i)=>i>=row&&r[col][0]!==0n);if(p<0)continue;
    [m[row],m[p]]=[m[p],m[row]];const d=m[row][col];m[row]=m[row].map(x=>over(x,d));
    for(let k=0;k<m.length;k++)if(k!==row){const f=m[k][col];if(f[0]!==0n)m[k]=m[k].map((x,j)=>minus(x,times(f,m[row][j])));}
    pivot.push(col);row++;
  }
  return {m,pivot};
}
function singleDependency(rows){
  const n=rows.length,transpose=rows[0].map((_,j)=>rows.map(r=>r[j]));
  const {m,pivot}=echelon(transpose);if(pivot.length!==n-1)return null;
  const free=Array.from({length:n},(_,i)=>i).find(i=>!pivot.includes(i));
  const vector=zeros(n);vector[free]=one();
  pivot.forEach((col,i)=>{vector[col]=negative(m[i][free]);});
  return vector.every(x=>x[0]!==0n)?vector:null;
}
function solveSquare(rows,rhs){
  const n=rows.length,{m,pivot}=echelon(rows.map((r,i)=>[...r,rhs[i]]));
  if(pivot.length!==n||pivot.some((p,i)=>p!==i))return null;
  return m.map(r=>r[n]);
}
function forward(law,controls,initial){
  const A=law.A.map(r=>r.map(read)),B=law.B.map(r=>r.map(read)),C=law.C.map(read);
  let state=initial.slice();const outputs=[];
  for(let t=0;t<=controls.length;t++){
    outputs.push(dot(C,state));
    if(t<controls.length)state=A.map((row,i)=>plus(dot(row,state),dot(B[i],controls[t])));
  }
  return outputs;
}
function compile(request){
  const horizon=request.controlBounds.length,channels=request.controlBounds[0].min.length,dimensions=horizon*channels;
  const noInput=Array.from({length:horizon},()=>zeros(channels));
  const laws=request.hypotheses.map(law=>{
    const stateColumns=Array.from({length:law.A.length},(_,j)=>forward(law,noInput,
      Array.from({length:law.A.length},(_,i)=>rational(BigInt(i===j)))));
    const inputColumns=Array.from({length:dimensions},(_,j)=>{
      const input=noInput.map(r=>r.slice());input[Math.floor(j/channels)][j%channels]=one();
      return forward(law,input,zeros(law.A.length));
    });
    return {state:Array.from({length:horizon+1},(_,t)=>stateColumns.map(c=>c[t])),
      input:Array.from({length:horizon+1},(_,t)=>inputColumns.map(c=>c[t]))};
  });
  const pairs=[];
  for(let i=0;i<laws.length;i++)for(let j=i+1;j<laws.length;j++)pairs.push({
    rows: laws[i].state.map((r,t)=>[...r,...laws[j].state[t].map(negative)]),
    response:laws[j].input.map((r,t)=>r.map((x,k)=>minus(x,laws[i].input[t][k])))});
  const lo=request.controlBounds.flatMap(b=>b.min.map(read)),hi=request.controlBounds.flatMap(b=>b.max.map(read));
  return {pairs,lo,hi,dimensions};
}
function circuitLines(pair,ticks,dimensions){
  const lines=[];
  for(let size=1;size<=ticks.length;size++)for(const chosen of combinations(ticks.length,size)){
    const support=chosen.map(i=>ticks[i]),weights=singleDependency(support.map(t=>pair.rows[t]));
    if(!weights)continue;
    const norm=weights.reduce((s,w)=>plus(s,rational(w[0]<0n?-w[0]:w[0],w[1])),zero());
    const coefficients=Array.from({length:dimensions},(_,k)=>over(dot(weights,support.map(t=>pair.response[t][k])),norm));
    if(coefficients.some(x=>x[0]!==0n))lines.push(coefficients,coefficients.map(negative));
  }
  return lines.length?lines:[zeros(dimensions)];
}
function* tuples(bundles,k=0,prefix=[]){
  if(k===bundles.length){yield prefix;return;}
  for(const line of bundles[k])yield* tuples(bundles,k+1,[...prefix,line]);
}
function vertexLP(lines,lo,hi,counters){
  const free=lo.flatMap((v,i)=>compare(v,hi[i])===0?[]:[i]),fixed=lo.map((_,i)=>i).filter(i=>!free.includes(i));
  const dimension=free.length+1,A=[],b=[];
  for(const line of lines){A.push([...free.map(i=>negative(line[i])),one()]);b.push(dot(fixed.map(i=>line[i]),fixed.map(i=>lo[i])));}
  for(let j=0;j<free.length;j++){
    const upper=zeros(dimension);upper[j]=one();A.push(upper);b.push(hi[free[j]]);
    const lower=zeros(dimension);lower[j]=negative(one());A.push(lower);b.push(negative(lo[free[j]]));
  }
  let best=null;
  for(const active of combinations(A.length,dimension)){
    counters.vertices++;
    const point=solveSquare(active.map(i=>A[i]),active.map(i=>b[i]));
    if(!point||A.some((row,i)=>compare(dot(row,point),b[i])>0))continue;
    if(best===null||compare(point[dimension-1],best)>0)best=point[dimension-1];
  }
  if(best===null)throw Error('A nonempty bounded box must yield a finite free-margin LP vertex');
  return best;
}
export function exhaustiveJointReference(request){
  const {pairs,lo,hi,dimensions}=compile(request),ticks=[...request.offeredTicks].sort((a,b)=>a-b);
  const counters={schedules:0,tuples:0,vertices:0};
  const maximum=schedule=>{
    counters.schedules++;let best=null;
    for(const chosen of tuples(pairs.map(pair=>circuitLines(pair,schedule,dimensions)))){
      counters.tuples++;const value=vertexLP(chosen,lo,hi,counters);
      if(best===null||compare(value,best)>0)best=value;
    }
    return best;
  };
  const potential=maximum(ticks),threshold=times(read(request.noiseBound??0),read(2));
  let winner=null;
  if(compare(potential,threshold)>0)for(let size=1;size<=request.maxReadings;size++){
    for(const subset of combinations(ticks.length,size)){
      const schedule=subset.map(i=>ticks[i]),margin=maximum(schedule);
      if(compare(margin,threshold)<=0)continue;
      const cost=schedule.reduce((sum,t)=>sum+(request.costByTick?.[t]??1),0);
      const lex=(a,b)=>{for(let j=0;j<a.length;j++)if(a[j]!==b[j])return a[j]-b[j];return 0;};
      if(!winner||cost<winner.cost||(cost===winner.cost&&lex(schedule,winner.ticks)<0))winner={ticks:schedule,cost,margin};
    }
    if(winner)break;
  }
  return {potential:string(potential),selection:winner?.ticks??null,cost:winner?.cost??null,
    margin:winner?string(winner.margin):null,counters};
}
