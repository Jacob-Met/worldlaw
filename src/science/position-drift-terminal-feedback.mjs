/** Physical state and conditional last-reading intervals for finite rate catalogs. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {parsePositionDriftRates} from './persistent-position-drift-planner.mjs';
import {positionDriftStateRegion} from './persistent-position-drift.mjs';

const {Q,Z,add,sub,mul,div,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const need=(ok,msg)=>{if(!ok)throw Error('Terminal drift feedback: '+msg);};

export function openPositionDriftFeedback(source){
  const {commands,ids,rates,error}=parsePositionDriftRates(source,rational);
  function prepare(word,values){
    need(Array.isArray(word) && Array.isArray(values) && values.length===word.length+1,
      'give one reading at tick zero and after each command');
    const actions=word.map(name=>{const u=commands.indexOf(name);need(u>=0,'command outside catalog');return u;});
    const ys=values.map(rational);
    return rates.map((row,i)=>{
      let forcing=Z();
      const centers=ys.map((y,t)=>{
        if(t)forcing=add(forcing,row[actions[t-1]]);
        return sub(y,forcing);
      });
      return {law:ids[i],row,forcing,centers,state:positionDriftStateRegion(centers,error)};
    }).filter(x=>x.state);
  }
  function receive(word,values){
    return prepare(word,values).map(({law,state})=>({law,start:state.initialWitness}));
  }
  function finalOptions(word,values){
    need(word.length>=1,'at least two preceding observation times are needed for bounded last readings');
    const n=word.length+1;
    const projections=prepare(word,values).map(({law,row,forcing,centers})=>{
      let lo=null,hi=null;
      // The old strips already intersect. By planar Helly it suffices to
      // intersect the last strip with every pair of distinct old strips.
      for(let j=1;j<n;j++)for(let i=0;i<j;i++){
        const left=Q(BigInt(n-i)),right=Q(BigInt(n-j)),span=Q(BigInt(j-i));
        const center=div(sub(mul(left,centers[j]),mul(right,centers[i])),span);
        const radius=div(mul(mul(Q(2n),error),left),span);
        const a=sub(center,radius),b=add(center,radius);
        if(lo===null||cmp(a,lo)>0)lo=a;
        if(hi===null||cmp(b,hi)<0)hi=b;
      }
      need(cmp(lo,hi)<=0,'nonempty physical prefix has an empty last-reading projection');
      return {law,row,lo:add(forcing,lo),hi:add(forcing,hi)};
    });
    return commands.map((command,u)=>{
      const intervals=projections.map(({law,row,lo,hi})=>({law,lo:add(lo,row[u]),hi:add(hi,row[u])}));
      const collisions=[];
      for(let j=1;j<intervals.length;j++)for(let i=0;i<j;i++){
        const a=intervals[i],b=intervals[j];
        const lo=cmp(a.lo,b.lo)>0?a.lo:b.lo,hi=cmp(a.hi,b.hi)<0?a.hi:b.hi;
        if(cmp(lo,hi)<=0)collisions.push({laws:[a.law,b.law],readings:[fmt(lo),fmt(hi)]});
      }
      return {command,intervals:intervals.map(x=>({law:x.law,readings:[fmt(x.lo),fmt(x.hi)]})),collisions};
    });
  }
  return {receive,finalOptions};
}

export function selectSafePositionDriftCommand(options,order=options.map(o=>o.command)){
  return order.find(command=>options.some(o=>o.command===command&&o.intervals.length&&!o.collisions.length))??null;
}

export function caseEightRateCatalog(){
  return {schema:'worldlaw.position-drift-rate-catalog/v1',commands:['u0','u1','u2'],noiseBound:'1',
    laws:[[-2,-2,5],[1,-2,6],[-1,-4,0],[6,7,-3]].map((rates,i)=>({id:'L'+i,rates}))};
}

export function openCaseEightSixPulseAdversary(){
  const source=caseEightRateCatalog(),physical=openPositionDriftFeedback(source);
  const word=[],readings=['0'];
  let terminalRule=null;
  function pulse(command){
    const u=source.commands.indexOf(command);
    need(u>=0 && word.length<6,'expected one catalog command within the six-pulse course');
    const rateSum=source.laws[0].rates[u]+source.laws[1].rates[u];
    let next=fmt(add(rational(readings.at(-1)),Q(BigInt(rateSum),2n)));
    if(word.length===5){
      const survivors=physical.receive([...word,command],[...readings,next]);
      if(survivors.length>=2)terminalRule='primary-midpoint';
      else{
        // The preceding five replies are immutable, and the sixth command
        // has already arrived. The alternative last reading belongs to both
        // worlds' closed intervals on that exact shared prefix.
        const option=physical.finalOptions(word,readings)[u];
        need(option.collisions.length,'no last reading can preserve two physical worlds');
        next=option.collisions[0].readings[0];terminalRule='terminal-collision';
      }
    }
    word.push(command);readings.push(next);
    return next;
  }
  function certificate(){
    const witnesses=physical.receive(word,readings);
    need(witnesses.length>=2,'the common transcript lost its physical collision');
    return {commands:[...word],readings:[...readings],witnesses,terminalRule};
  }
  return {initialReading:'0',pulse,certificate};
}
