/** Four adaptive pulses with one correlated position/drift state and five readings. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseIntegratorReading} from './active-integrator-two-pulse.mjs';
import {CATALOG_SCHEMA, parsePositionDriftRates, positionDriftStates,
  equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {compare, minimum, maximum, midpoint, contains, fourPulseCenter,
  pairFourPulseProjection, commonFourthReading, section, sortedCuts,
  trappedSections, unsafeThirdBands} from './persistent-four-pulse-geometry.mjs';

const {Q,Z,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const need=(ok,message)=>{if(!ok)throw Error('Four-pulse position/drift planner: '+message);};
const schema='worldlaw.position-drift-four-pulse-policy/v1';
const recordSchema='worldlaw.position-drift-four-pulse-record/v1';

function inventories(catalog,a,b,c){
  return catalog.commands.map((_,d)=>{
    const centers=catalog.rates.map(row=>fourPulseCenter([row[a],row[b],row[c],row[d]]));
    const pairs=[];
    for(let j=1;j<centers.length;j++)for(let i=0;i<j;i++){
      const overlap=pairFourPulseProjection(centers[i],centers[j],catalog.error);
      if(overlap)pairs.push({i,j,...overlap});
    }
    return pairs;
  });
}
function refusal(catalog,a,b,allThird,s){
  const thirds=allThird.map(({byFinal},c)=>{
    const t=trappedSections(byFinal,s)[0][0];
    const finals=byFinal.map((pairs,d)=>{
      const pair=pairs.find(p=>{const r=section(p.polygon,s);return r&&contains(r,t);});
      need(pair,'trapped prefix lost its final collision');
      const w=commonFourthReading(pair.planes,s,t), ys=[Z(),Z(),s,t,w];
      const matching=positionDriftStates(catalog,[a,b,c,d],ys)
        .filter(p=>p.law===catalog.ids[pair.i]||p.law===catalog.ids[pair.j]);
      need(matching.length===2,'geometric collision lost its physical initial states');
      return {command:catalog.commands[d],reading:fmt(w),
        witnesses:matching.map(p=>({law:p.law,start:p.initialWitness}))};
    });
    return {command:catalog.commands[c],reading:fmt(t),finals};
  });
  return {first:catalog.commands[a],second:catalog.commands[b],commonReadings:['0','0',fmt(s)],thirds};
}
function firstPair(catalog,a,b){
  const spread=mul(Q(4n),catalog.error);
  const prefix=catalog.rates.map(row=>{const s=sub(row[b],row[a]);return [sub(s,spread),add(s,spread)];});
  const allThird=catalog.commands.map((_,c)=>{
    const byFinal=inventories(catalog,a,b,c);
    return {byFinal,bad:unsafeThirdBands(byFinal)};
  });
  const boundaries=sortedCuts([...prefix,...allThird.flatMap(t=>t.bad)].flat());
  const action=s=>prefix.some(r=>contains(r,s))?allThird.findIndex(t=>!t.bad.some(r=>contains(r,s))):null;
  const regions=[];
  function include(lo,hi,c){
    const last=regions.at(-1);
    if(last?.command===catalog.commands[c] && last.range[1]===fmt(lo))last.range[1]=fmt(hi);
    else regions.push({range:[fmt(lo),fmt(hi)],command:catalog.commands[c]});
  }
  for(let k=0;k<boundaries.length;k++){
    const lo=boundaries[k],hi=boundaries[k+1],left=action(lo);
    if(left===-1)return {refusal:refusal(catalog,a,b,allThird,lo)};
    if(left!==null)include(lo,lo,left);
    if(!hi)continue;
    const m=midpoint(lo,hi),middle=action(m);
    if(middle===null)continue;
    if(middle===-1)return {refusal:refusal(catalog,a,b,allThird,m)};
    const right=action(hi);
    if(right===-1)return {refusal:refusal(catalog,a,b,allThird,hi)};
    need(left!==null&&right!==null,'closed reachable slab lost an endpoint');
    include(lo,m,left);include(m,hi,right);
  }
  const used=new Set(regions.map(r=>r.command));
  const fourth=allThird.flatMap(({byFinal},c)=>used.has(catalog.commands[c])?[{
    third:catalog.commands[c],actions:byFinal.map((pairs,d)=>({command:catalog.commands[d],
      ambiguous:pairs.map(p=>({laws:[catalog.ids[p.i],catalog.ids[p.j]],
        vertices:p.polygon.map(point=>point.map(fmt))}))})),
  }]:[]);
  return {regions,fourth};
}
export function planFourPulsePositionDrift(source){
  const catalog=parsePositionDriftRates(source),refusals=[];
  const contract={schema:CATALOG_SCHEMA,commands:catalog.commands.slice(),noiseBound:fmt(catalog.error),
    laws:catalog.ids.map((id,i)=>({id,rates:catalog.rates[i].map(fmt)}))};
  for(let a=0;a<catalog.commands.length;a++)for(let b=0;b<catalog.commands.length;b++){
    const result=firstPair(catalog,a,b);
    if(result.refusal){refusals.push(result.refusal);continue;}
    return {schema,source:contract,status:'identified',first:catalog.commands[a],second:catalog.commands[b],
      thirdRegions:result.regions,fourthDecisions:result.fourth};
  }
  return {schema,source:contract,status:'impossible',refusals};
}
export function replayFourPulsePositionDriftPolicy(source,policy){
  const rebuilt=planFourPulsePositionDrift(source);
  need(equalPositionDriftData(rebuilt,policy),'saved policy differs from prospective derivation');
  return rebuilt;
}
function nextAction(policy,commands,ys,t){
  if(t===0)return policy.first;
  if(t===1)return policy.second;
  const s=add(sub(ys[2],mul(Q(2n),ys[1])),ys[0]);
  if(t===2)return policy.thirdRegions.find(r=>contains(r.range.map(parseIntegratorReading),s))?.command;
  const v=add(sub(ys[3],mul(Q(3n),ys[1])),mul(Q(2n),ys[0]));
  const menu=policy.fourthDecisions.find(p=>p.third===commands[2]);
  return menu.actions.find(a=>!a.ambiguous.some(p=>{
    const r=section(p.vertices.map(point=>point.map(parseIntegratorReading)),s);
    return r&&contains(r,v);
  }))?.command;
}
function receive(catalog,policy,values){
  need(policy.status==='identified','no guaranteed policy for this catalog');
  need(Array.isArray(values)&&values.length>=1&&values.length<=5,'supply one to five exact readings');
  const ys=values.map(parseIntegratorReading),commands=[],indices=[],rounds=[];
  for(let t=0;t<ys.length;t++){
    const surviving=positionDriftStates(catalog,indices,ys.slice(0,t+1));
    const next=(t===4||!surviving.length)?null:nextAction(policy,commands,ys,t);
    need(next!==undefined,'feasible prefix missing a safe action');
    rounds.push({tick:t,surviving,next});
    if(t+1<ys.length){
      need(next!==null,'a reading followed an impossible prefix');
      commands.push(next);indices.push(catalog.commands.indexOf(next));
    }
  }
  return {schema:recordSchema,readings:ys.map(fmt),commands,rounds};
}
// Compile and validate once for repeated observations, keeping the canonical
// reconstructed policy in a closure independent of later caller mutations.
export function openFourPulsePositionDrift(source,policy){
  const rebuilt=replayFourPulsePositionDriftPolicy(source,policy), catalog=parsePositionDriftRates(rebuilt.source);
  return {
    observe:values=>receive(catalog,rebuilt,values),
    replay:record=>{
      need(record?.schema===recordSchema,'unrecognized record');
      const rebuiltRecord=receive(catalog,rebuilt,record.readings);
      need(equalPositionDriftData(rebuiltRecord,record),'saved transcript differs from exact replay');
      return rebuiltRecord;
    },
  };
}
