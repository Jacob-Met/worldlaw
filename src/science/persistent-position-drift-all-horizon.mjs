/** Finite-horizon identifiability under unknown position and constant drift. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {CATALOG_SCHEMA, parsePositionDriftRates, equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {positionDriftStateRegion} from './persistent-position-drift.mjs';

const {Q,Z,add,sub,mul,div,fmt} = ACTIVE_LINEAR_EXACT_ARITHMETIC;
const schema = 'worldlaw.position-drift-all-horizon-policy/v1';
const recordSchema = 'worldlaw.position-drift-all-horizon-readings/v1';
const aliasSchema = 'worldlaw.position-drift-all-horizon-gauge-trace/v1';
const need = (ok,reason) => { if (!ok) throw Error('All-horizon position/drift: '+reason); };
const cmp = (a,b) => a.n*b.d < b.n*a.d ? -1 : a.n*b.d > b.n*a.d ? 1 : 0;
const abs = x => x.n < 0n ? Q(-x.n,x.d) : x;

// Arbitrarily small source gaps and large checkpoint positions are intrinsic
// to this theorem. Decimal exponents and binary floats are unnecessary.
function rational(value) {
  if (typeof value === 'number') {
    need(Number.isSafeInteger(value),'use an exact rational string outside the safe integer range');
    value=String(value);
  }
  need(typeof value==='string' && /^[+-]?[0-9]+(?:\/[1-9][0-9]*)?$/.test(value),
    'expected an exact integer or rational string');
  const [n,d='1']=value.split('/');
  return Q(BigInt(n),BigInt(d));
}
export {rational as parseAllHorizonRational};
function count(value) {
  const n=rational(value);
  need(n.d===1n && n.n>0n,'repeat counts must be positive integers');
  return n.n;
}

function classify(catalog) {
  const bySignature=new Map();
  catalog.rates.forEach((row,i)=>{
    const key=JSON.stringify(row.map(rate=>fmt(sub(rate,row[0]))));
    const group=bySignature.get(key)??[];
    group.push(i);
    bySignature.set(key,group);
  });
  return [...bySignature.values()];
}

function rateDifferenceRange(catalog,i,j) {
  const differences=catalog.rates[i].map((v,u)=>sub(v,catalog.rates[j][u]));
  let low=0, high=0;
  for (let u=1;u<differences.length;u++) {
    if (cmp(differences[u],differences[low])<0) low=u;
    if (cmp(differences[u],differences[high])>0) high=u;
  }
  const gap=sub(differences[high],differences[low]);
  return {low,high,gap};
}

function buildBlocks(catalog) {
  const blocks=[], index=new Map(), comparisons=[];
  const threshold=mul(Q(8n),catalog.error);
  for (let j=1;j<catalog.ids.length;j++) {
    for (let i=0;i<j;i++) {
      const {low,high,gap}=rateDifferenceRange(catalog,i,j);
      need(gap.n>0n,'an unseparated gauge pair reached schedule construction');
      const ratio=div(threshold,gap);
      const repetitions=ratio.n/ratio.d+1n;
      // Swapping the two commands only changes the sign of the contrast.
      const a=Math.min(low,high), b=Math.max(low,high), key=a+','+b;
      if (!index.has(key)) {
        index.set(key,blocks.length);
        blocks.push({a,b,repetitions});
      }
      const k=index.get(key);
      if (repetitions>blocks[k].repetitions) blocks[k].repetitions=repetitions;
      comparisons.push({i,j,k});
    }
  }
  const radius=mul(Q(4n),catalog.error);
  const pairCertificates=comparisons.map(({i,j,k})=>{
    const {a,b,repetitions}=blocks[k];
    const centers=[i,j].map(index=>mul(Q(repetitions),sub(catalog.rates[index][b],catalog.rates[index][a])));
    const margin=sub(abs(sub(centers[0],centers[1])),threshold);
    need(margin.n>0n,'contrast intervals touch');
    return {laws:[catalog.ids[i],catalog.ids[j]],block:k,centers:centers.map(fmt),
      intervals:centers.map(c=>[fmt(sub(c,radius)),fmt(add(c,radius))]),margin:fmt(margin)};
  });
  let tick=0n;
  const readAt=['0'];
  const schedule=blocks.map(({a,b,repetitions})=>{
    const from=tick, middle=tick+repetitions;
    tick=middle+repetitions;
    readAt.push(String(middle),String(tick));
    return {first:catalog.commands[a],second:catalog.commands[b],repeats:String(repetitions),
      ticks:[String(from),String(middle),String(tick)]};
  });
  return {schedule,readAt,pulseUpperBound:String(tick),pairCertificates};
}

function canonicalSource(catalog){
  return {schema:CATALOG_SCHEMA,commands:catalog.commands.slice(),noiseBound:fmt(catalog.error),
    laws:catalog.ids.map((id,i)=>({id,rates:catalog.rates[i].map(fmt)}))};
}

export function planAllHorizonPositionDrift(source) {
  const catalog=parsePositionDriftRates(source,rational);
  const contract=canonicalSource(catalog);
  const groups=classify(catalog);
  const classes=groups.map(group=>group.map(i=>catalog.ids[i]));
  const witnesses=[];
  for (const group of groups) {
    for (let j=1;j<group.length;j++) for (let i=0;i<j;i++) {
      const first=group[i],second=group[j];
      const shift=sub(catalog.rates[first][0],catalog.rates[second][0]);
      witnesses.push({laws:[catalog.ids[first],catalog.ids[second]],driftShift:fmt(shift),
        firstStart:['0','0'],secondStart:['0',fmt(shift)]});
    }
  }
  if (witnesses.length) return {schema,source:contract,status:'indistinguishable',classes,witnesses};
  return {schema,source:contract,status:'finite-schedule',classes,...buildBlocks(catalog)};
}

export function replayAllHorizonPositionDriftPolicy(source,policy) {
  const rebuilt=planAllHorizonPositionDrift(source);
  need(equalPositionDriftData(rebuilt,policy),'saved policy differs from source derivation');
  return rebuilt;
}

function runsFromSchedule(policy) {
  return policy.schedule.flatMap(b=>[b.first,b.second].map(command=>({command,repeats:b.repeats})));
}
function readSchedule(policy,catalog,runs,values) {
  need(Array.isArray(values)&&values.length>=1&&values.length<=policy.readAt.length,
    'supply a measurement prefix on the declared checkpoints');
  const ys=values.map(rational), ticks=policy.readAt.slice(0,ys.length);
  const surviving=catalog.rates.flatMap((rates,i)=>{
    let forcing=Z();
    const centers=ys.map((y,t)=>{
      if (t>0) {
        const run=runs[t-1];
        forcing=add(forcing,mul(Q(run.n),rates[run.u]));
      }
      return sub(y,forcing);
    });
    const state=positionDriftStateRegion(centers,catalog.error,ticks);
    return state?[{law:catalog.ids[i],...state}]:[];
  });
  if (ys.length===policy.readAt.length) need(surviving.length<=1,'full schedule left an unresolved pair');
  return {schema:recordSchema,ticks,readings:ys.map(fmt),surviving,
    nextTick:surviving.length&&ys.length<policy.readAt.length?policy.readAt[ys.length]:null};
}

function traceAlias(catalog,first,second,runs,origin) {
  const i=catalog.ids.indexOf(first),j=catalog.ids.indexOf(second);
  need(i>=0&&j>=0&&i!==j,'select two distinct catalog laws');
  const shift=sub(catalog.rates[i][0],catalog.rates[j][0]);
  need(catalog.rates[i].every((r,u)=>cmp(sub(r,catalog.rates[j][u]),shift)===0),
    'the selected laws are distinguishable');
  need(Array.isArray(origin)&&origin.length===2,'supply initial position and drift');
  need(Array.isArray(runs),'supply a finite word of named run-length commands');
  const [p,v]=origin.map(rational),drifts=[v,add(v,shift)];
  const positions=[p,p],ticks=['0'],readings=[[fmt(p)],[fmt(p)]];
  let tick=0n;
  const word=runs.map(run=>{
    need(run && Object.keys(run).sort().join(',')==='command,repeats','malformed command run');
    const u=catalog.commands.indexOf(run.command),n=count(run.repeats);
    need(u>=0,'command absent from menu');
    for (const [index,law] of [i,j].entries()) {
      positions[index]=add(positions[index],mul(Q(n),add(drifts[index],catalog.rates[law][u])));
      readings[index].push(fmt(positions[index]));
    }
    need(cmp(positions[0],positions[1])===0,'gauge witness failed physical replay');
    tick+=n;ticks.push(String(tick));
    return {command:run.command,repeats:String(n)};
  });
  return {schema:aliasSchema,laws:[first,second],origin:[fmt(p),fmt(v)],driftShift:fmt(shift),
    starts:drifts.map(d=>[fmt(p),fmt(d)]),word,ticks,readings};
}

export function openAllHorizonPositionDrift(source,policy) {
  const rebuilt=replayAllHorizonPositionDriftPolicy(source,policy);
  const catalog=parsePositionDriftRates(rebuilt.source,rational);
  if (rebuilt.status==='indistinguishable') {
    const trace=(first,second,runs,origin=['0','0'])=>traceAlias(catalog,first,second,runs,origin);
    return {trace,replay:record=>{
      need(record?.schema===aliasSchema && Array.isArray(record.laws) && record.laws.length===2,'invalid gauge record');
      const actual=trace(...record.laws,record.word,record.origin);
      need(equalPositionDriftData(actual,record),'saved gauge trace differs from physical replay');
      return actual;
    }};
  }
  const runs=runsFromSchedule(rebuilt).map(r=>({u:catalog.commands.indexOf(r.command),n:BigInt(r.repeats)}));
  const observe=values=>readSchedule(rebuilt,catalog,runs,values);
  return {observe,replay:record=>{
    need(record?.schema===recordSchema,'invalid checkpoint record');
    const actual=observe(record.readings);
    need(equalPositionDriftData(actual,record),'saved checkpoint record differs from physical replay');
    return actual;
  }};
}

// Exact binary horizon. The older finite-catalog policy and its replay format
// remain independent of this tighter two-law construction.
function binaryRates(source) {
  const catalog=parsePositionDriftRates(source,rational);
  need(catalog.ids.length===2,'the minimum-horizon certificate requires exactly two laws');
  return {catalog,...rateDifferenceRange(catalog,0,1)};
}
function binaryDistance(gap,n){
  if(n===0n)return Z();
  const a=n/2n;
  return mul(gap,Q(a*(n-a),2n * n));
}

export function planBinaryPositionDriftMinimum(source){
  const {catalog,low,high,gap}=binaryRates(source);
  const threshold=mul(Q(2n),catalog.error);
  const base={schema:'worldlaw.position-drift-binary-minimum/v1',source:canonicalSource(catalog),laws:catalog.ids,
    gap:fmt(gap),collisionThreshold:fmt(threshold)};
  if(gap.n===0n){
    const [witness]=planAllHorizonPositionDrift(source).witnesses;
    return {...base,status:'indistinguishable',minimumPulses:null,witness};
  }
  // D(n) <= n*gap/8, with equality at every even n.
  const lower=div(mul(Q(16n),catalog.error),gap);
  let n=lower.n/lower.d+1n;
  if(cmp(binaryDistance(gap,n),threshold)<=0)n++;
  const a=n/2n,b=n-a;
  const runs=[{command:catalog.commands[low],repeats:String(a)},
    {command:catalog.commands[high],repeats:String(b)}];
  return {...base,status:'minimum-schedule',minimumPulses:String(n),runs,readAt:['0',String(a),String(n)],
    previousDistance:fmt(binaryDistance(gap,n-1n)),optimalDistance:fmt(binaryDistance(gap,n)),
    margin:fmt(sub(binaryDistance(gap,n),threshold))};
}

export function openBinaryPositionDriftMinimum(source,policy){
  const canonical=planBinaryPositionDriftMinimum(source);
  need(equalPositionDriftData(canonical,policy),'saved binary minimum differs from source derivation');
  const {catalog,gap}=binaryRates(source);
  // Each reply uses only the chosen command and the current forcing; a caller
  // can choose the next action after seeing precisely this reply.
  function midpointAdversary(){
    const runs=[],ticks=['0'],forces=[[Z(),Z()]],readings=['0'];
    let tick=0n;
    function pulse(command,repeats='1'){
      const u=catalog.commands.indexOf(command), n=count(repeats);
      need(u>=0,'command absent from binary menu');
      const next=tick+n;
      need(cmp(binaryDistance(gap,next),mul(Q(2n),catalog.error))<=0,
        'this horizon exceeds the universal binary collision guarantee');
      const f=catalog.rates.map((rates,i)=>add(forces.at(-1)[i],mul(Q(n),rates[u])));
      const y=fmt(div(add(f[0],f[1]),Q(2n)));
      forces.push(f);readings.push(y);ticks.push(String(next));runs.push({command,repeats:String(n)});
      tick=next;
      return y;
    }
    function collision(){
      const differences=forces.map(([a,b])=>sub(a,b));
      const slope=tick===0n?Z():div(differences.at(-1),Q(tick));
      // Center the chord residual. Extremes occur at run endpoints since
      // forcing, chord and midpoint readings interpolate linearly inside a run.
      const residuals=differences.map((s,i)=>sub(s,mul(Q(BigInt(ticks[i])),slope)));
      let lo=Z(),hi=Z();
      for(const r of residuals){if(cmp(r,lo)<0)lo=r;if(cmp(r,hi)>0)hi=r;}
      const intercept=div(add(lo,hi),Q(2n));
      const starts=[Q(-1n,2n),Q(1n,2n)].map(sign=>[fmt(mul(sign,intercept)),fmt(mul(sign,slope))]);
      return {laws:catalog.ids.slice(),runs:runs.map(r=>({...r})),ticks:ticks.slice(),
        readings:readings.slice(),starts,maximumError:fmt(div(sub(hi,lo),Q(4n)))};
    }
    return {initialReading:'0',pulse,collision};
  }
  if(canonical.status==='indistinguishable')return {midpointAdversary};
  const runs=canonical.runs.map(r=>({u:catalog.commands.indexOf(r.command),n:BigInt(r.repeats)}));
  const observe=values=>readSchedule(canonical,catalog,runs,values);
  return {midpointAdversary,observe};
}
