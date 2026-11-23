/** Certify a multiclass minimum when one fixed tape attains a binary lower bound. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {planBinaryPositionDriftMinimum,planAllHorizonPositionDrift,parseAllHorizonRational} from './persistent-position-drift-all-horizon.mjs';
import {positionDriftStateRegion} from './persistent-position-drift.mjs';
import {parsePositionDriftRates,equalPositionDriftData} from './persistent-position-drift-planner.mjs';

const {Q,Z,add,sub,mul,div,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const need=(ok,message)=>{if(!ok)throw Error('Multiclass horizon: '+message);};
const greater=(a,b)=>a.n*b.d>b.n*a.d;
const abs=q=>q.n<0n?Q(-q.n,q.d):q;

function compileRuns(catalog,runs){
  need(Array.isArray(runs),'supply a run-length tape');
  const ticks=[0n],forces=catalog.rates.map(()=>[Z()]);
  const word=[];
  for(const run of runs){
    need(run && Object.keys(run).sort().join(',')==='command,repeats','malformed command run');
    const u=catalog.commands.indexOf(run.command);
    const n=parseAllHorizonRational(run.repeats);
    need(u>=0 && n.d===1n && n.n>0n,'expected a catalog command and a positive repeat count');
    word.push({command:run.command,repeats:String(n.n)});
    ticks.push(ticks.at(-1)+n.n);
    catalog.rates.forEach((rates,i)=>forces[i].push(add(forces[i].at(-1),mul(n,rates[u]))));
  }
  return {ticks,forces,word};
}

function separatingTriple(difference,ticks,error){
  // On three ticks the unknown intercept and slope cancel in this signed
  // contrast. Each law's error radius is 2*(t_k-t_i)*epsilon.
  for(let k=2;k<ticks.length;k++)for(let j=1;j<k;j++)for(let i=0;i<j;i++){
    const before=Q(ticks[j]-ticks[i]),after=Q(ticks[k]-ticks[j]);
    const contrast=sub(mul(before,sub(difference[k],difference[j])),mul(after,sub(difference[j],difference[i])));
    const threshold=mul(Q(4n*(ticks[k]-ticks[i])),error);
    if(greater(abs(contrast),threshold))return {ticks:[i,j,k].map(t=>String(ticks[t])),
      signedDifference:fmt(contrast),contactThreshold:fmt(threshold),margin:fmt(sub(abs(contrast),threshold))};
  }
  return null;
}

function evaluate(catalog,runs,withRecord){
  const {ticks,forces,word}=compileRuns(catalog,runs);
  const tickStrings=ticks.map(String),pairs=[];
  for(let j=1;j<catalog.ids.length;j++)for(let i=0;i<j;i++){
    const laws=[catalog.ids[i],catalog.ids[j]];
    const delta=forces[i].map((x,t)=>sub(x,forces[j][t]));
    const separator=separatingTriple(delta,ticks,catalog.error);
    if(separator){if(withRecord)pairs.push({laws,...separator});continue;}
    if(!withRecord)return false;
    const ys=forces[i].map((x,t)=>div(add(x,forces[j][t]),Q(2n)));
    const starts=[i,j].map(k=>{
      const state=positionDriftStateRegion(ys.map((y,t)=>sub(y,forces[k][t])),catalog.error,tickStrings);
      need(state,'a nonseparated pair has no common midpoint trajectory');
      return state.initialWitness;
    });
    return {status:'fixed-tape-collision',runs:word,pulses:String(ticks.at(-1)),
      collision:{laws,ticks:tickStrings,readings:ys.map(fmt),starts}};
  }
  return withRecord?{status:'separating-fixed-tape',runs:word,pulses:String(ticks.at(-1)),pairs}:true;
}

export function certifyPositionDriftTape(source,runs){
  return evaluate(parsePositionDriftRates(source,parseAllHorizonRational),runs,true);
}

function insertCommand(runs,command){
  const last=runs.at(-1);
  if(last?.command===command)last.repeats=String(BigInt(last.repeats)+1n);
  else runs.push({command,repeats:'1'});
}

// Exhaustive search is optional, bounded by both a declared pulse length
// and a total candidate budget. A partial enumeration proves no lower bound.
export function certifyMulticlassPositionDriftMinimum(source,options={}){
  need(options && Object.keys(options).every(k=>k==='enumerateThrough'||k==='wordBudget'),'unexpected search option');
  const {enumerateThrough=0,wordBudget=0}=options;
  need(Number.isSafeInteger(enumerateThrough)&&enumerateThrough>=0 &&
    Number.isSafeInteger(wordBudget)&&wordBudget>=0,'search limits must be nonnegative safe integers');
  const limits={enumerateThrough,wordBudget};
  const original=planAllHorizonPositionDrift(source);
  const base={schema:'worldlaw.multiclass-position-drift-minimum/v1',source:original.source,limits};
  if(original.status==='indistinguishable')return {...base,status:'indistinguishable',witnesses:original.witnesses};
  const catalog=parsePositionDriftRates(source,parseAllHorizonRational);
  let lower=0n;
  const bounds=[], extrema=new Map();
  for(let j=1;j<source.laws.length;j++)for(let i=0;i<j;i++){
    const binary=planBinaryPositionDriftMinimum({...source,laws:[source.laws[i],source.laws[j]]});
    const n=BigInt(binary.minimumPulses);
    bounds.push({laws:binary.laws,minimumPulses:binary.minimumPulses});
    if(n>lower)lower=n;
    const commands=binary.runs.map(r=>r.command).sort();
    extrema.set(JSON.stringify(commands),commands);
  }
  let fixedLower=lower,upper=BigInt(original.pulseUpperBound);
  let best=original.schedule.flatMap(b=>[b.first,b.second].map(command=>({command,repeats:b.repeats})));
  const enumerations=[];
  let balancedTapes=0,remaining=wordBudget;
  function tryTape(tape,n){
    if(!evaluate(catalog,tape,false))return false;
    upper=n;best=tape;return true;
  }
  if(lower<upper){
    const a=lower/2n,b=lower-a;
    search:for(const [u,v] of extrema.values())for(const [first,second] of [[u,v],[v,u]]){
      balancedTapes++;
      if(tryTape([{command:first,repeats:String(a)},{command:second,repeats:String(b)}],lower))break search;
    }
  }
  for(let n=lower;n<upper&&n<=BigInt(enumerateThrough)&&remaining>0;n++){
    // Count only up to the available budget. Even an enormous pulse horizon
    // needs at most logarithmically many multiplications here.
    const alphabet=BigInt(catalog.commands.length);
    let total=1n;
    for(let t=0n;t<n && total<=BigInt(remaining);t++)total*=alphabet;
    const allowed=Number(total<BigInt(remaining)?total:BigInt(remaining));
    let tested=0,found=false;
    for(let ordinal=0;ordinal<allowed;ordinal++){
      let value=BigInt(ordinal),written=0n;
      const tape=[];
      while(value>0n){
        insertCommand(tape,catalog.commands[Number(value%alphabet)]);
        value/=alphabet;written++;
      }
      if(written<n){
        // A nonzero ordinal ends in a nonzero most-significant digit.
        tape.push({command:catalog.commands[0],repeats:String(n-written)});
      }
      tested++;remaining--;
      if(tryTape(tape,n)){found=true;break;}
    }
    const complete=!found && BigInt(tested)===total;
    if(complete)fixedLower=n+1n;
    enumerations.push({pulses:String(n),wordsTested:tested,allWordsRejected:complete});
    if(found||!complete)break;
  }
  const tape=evaluate(catalog,best,true);
  need(tape.status==='separating-fixed-tape' && tape.pulses===String(upper),'upper bound lacks a physical separator');
  return {...base,status:lower===upper?'adaptive-minimum-certified':'adaptive-minimum-bounded',
    binaryBounds:bounds,adaptiveLower:String(lower),adaptiveUpper:String(upper),
    fixedLower:String(fixedLower),fixedUpper:String(upper),balancedTapes,enumerations,tape};
}

export function replayMulticlassPositionDriftMinimum(source,saved,options={}){
  const limits={enumerateThrough:0,wordBudget:0,...options};
  need(equalPositionDriftData(saved?.limits,limits),'replay requires the same caller-declared search limits');
  const actual=certifyMulticlassPositionDriftMinimum(source,limits);
  need(equalPositionDriftData(saved,actual),'saved bounds, search, tape or physical certificate differ');
  return actual;
}
