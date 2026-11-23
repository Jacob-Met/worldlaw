/** Complete finite-menu three-pulse planner with one unknown position and drift. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseIntegratorReading} from './active-integrator-two-pulse.mjs';
import {positionDriftStateRegion} from './persistent-position-drift.mjs';

const {Q,Z,add,sub,mul,div,fmt,parseSource} = ACTIVE_LINEAR_EXACT_ARITHMETIC;
const two = Q(2n), three = Q(3n), four = Q(4n);
const cmp = (a,b) => a.n*b.d < b.n*a.d ? -1 : a.n*b.d > b.n*a.d ? 1 : 0;
const min = (a,b) => cmp(a,b) <= 0 ? a : b;
const max = (a,b) => cmp(a,b) >= 0 ? a : b;
const mid = (a,b) => div(add(a,b),two);
const contains = ([a,b],x) => cmp(a,x)<=0 && cmp(x,b)<=0;
const need = (ok,msg) => { if (!ok) throw Error('Position/drift planner: '+msg); };
export const CATALOG_SCHEMA = 'worldlaw.position-drift-rate-catalog/v1';
const policySchema = 'worldlaw.position-drift-rate-policy/v1';
const recordSchema = 'worldlaw.position-drift-rate-record/v1';

function names(list) {
  return list.every(s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s)) && new Set(list).size===list.length;
}
function parse(source) {
  need(source?.schema===CATALOG_SCHEMA && Object.keys(source).sort().join(',')==='commands,laws,noiseBound,schema',
    'expected the declared command/rate catalog');
  const {commands,laws}=source;
  need(Array.isArray(commands) && commands.length>=1 && names(commands),
    'offer at least one uniquely named command');
  need(Array.isArray(laws) && laws.length>=2 && names(laws.map(l=>l?.id)),
    'offer at least two uniquely named laws');
  const rates=laws.map(l=>{
    need(Object.keys(l).sort().join(',')==='id,rates' && Array.isArray(l.rates) && l.rates.length===commands.length,
      'provide one exact rate per command');
    return l.rates.map(parseSource);
  });
  const error=parseSource(source.noiseBound);
  need(error.n>=0n,'provide a nonnegative noise bound');
  return {commands,ids:laws.map(l=>l.id),rates,error};
}
function same(a,b) {
  if(a===b) return true;
  if(!a || !b || typeof a!=='object' || typeof b!=='object' || Array.isArray(a)!==Array.isArray(b)) return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length && keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
}
function slabs(s,t,error) {
  // Four pairs of supporting lines of the projected error cube.
  const spread=mul(four,error);
  const lines=[[Z(),mul(Q(6n),error)],[two,spread],[div(three,two),mul(three,error)]]
    .map(([slope,width])=>{
      const intercept=sub(t,mul(slope,s));
      return {slope,lo:sub(intercept,width),hi:add(intercept,width)};
    });
  return {range:[sub(s,spread),add(s,spread)],lines};
}
function response(rates,a,b,c,error) {
  const s=sub(rates[b],rates[a]);
  const t=add(s,sub(rates[c],rates[a]));
  return slabs(s,t,error);
}
function joint(left,right) {
  let lo=max(left.range[0],right.range[0]), hi=min(left.range[1],right.range[1]);
  const lines=[...left.lines,...right.lines];
  for(const lower of lines) for(const upper of lines) {
    const coefficient=sub(lower.slope,upper.slope), rhs=sub(upper.hi,lower.lo);
    if(coefficient.n>0n) hi=min(hi,div(rhs,coefficient));
    else if(coefficient.n<0n) lo=max(lo,div(rhs,coefficient));
    else if(rhs.n<0n) return null;
    if(cmp(lo,hi)>0) return null;
  }
  return [lo,hi];
}
function overlapInventory(catalog,a,b) {
  const {rates,commands,error}=catalog;
  return commands.map((_,c)=>{
    const images=rates.map(row=>response(row,a,b,c,error));
    const overlaps=[];
    for(let j=1;j<images.length;j++) for(let i=0;i<j;i++){
      const range=joint(images[i],images[j]);
      if(range) overlaps.push({i,j,range});
    }
    return {images,overlaps};
  });
}
function vertices(ranges) {
  const sorted=ranges.flat().sort(cmp);
  return sorted.filter((x,i)=>i===0 || cmp(x,sorted[i-1])!==0);
}
function states(catalog,commands,ys) {
  return catalog.rates.flatMap((rates,k)=>{
    let forcing=Z();
    const centers=ys.map((y,t)=>{
      if(t>0) forcing=add(forcing,rates[commands[t-1]]);
      return sub(y,forcing);
    });
    const state=positionDriftStateRegion(centers,catalog.error);
    return state ? [{law:catalog.ids[k],...state}] : [];
  });
}
function collision(catalog,a,b,inventory,s) {
  const alternatives=inventory.map(({images,overlaps},c)=>{
    const {i,j}=overlaps.find(p=>contains(p.range,s));
    const lines=[...images[i].lines,...images[j].lines];
    const t=lines.map(line=>add(mul(line.slope,s),line.lo)).reduce(max);
    const readings=[Z(),Z(),s,t];
    const witnesses=states(catalog,[a,b,c],readings).filter(r=>r.law===catalog.ids[i]||r.law===catalog.ids[j]);
    need(witnesses.length===2,'internal overlap failed physical state reconstruction');
    return {third:catalog.commands[c],finalReading:fmt(t),witnesses:witnesses.map(r=>({law:r.law,start:r.initialWitness}))};
  });
  return {first:catalog.commands[a],second:catalog.commands[b],commonReadings:['0','0',fmt(s)],alternatives};
}
function inspect(catalog,a,b) {
  const inventory=overlapInventory(catalog,a,b);
  const prefix=inventory[0].images.map(p=>p.range);
  const cuts=vertices([...prefix,...inventory.flatMap(o=>o.overlaps.map(p=>p.range))]);
  function action(x) {
    if(!prefix.some(p=>contains(p,x))) return null;
    return inventory.findIndex(o=>!o.overlaps.some(p=>contains(p.range,x)));
  }
  const regions=[];
  function include(lo,hi,c) {
    const previous=regions.at(-1), command=catalog.commands[c];
    if(previous?.command===command && previous.range[1]===fmt(lo)) previous.range[1]=fmt(hi);
    else regions.push({range:[fmt(lo),fmt(hi)],command});
  }
  for(let k=0;k<cuts.length;k++){
    const lo=cuts[k], left=action(lo);
    if(left===-1) return {collision:collision(catalog,a,b,inventory,lo)};
    if(left!==null) include(lo,lo,left);
    if(k+1===cuts.length) continue;
    const hi=cuts[k+1], m=mid(lo,hi), interior=action(m);
    if(interior===null) continue;
    if(interior===-1) return {collision:collision(catalog,a,b,inventory,m)};
    const right=action(hi);
    if(right===-1) return {collision:collision(catalog,a,b,inventory,hi)};
    need(left!==null && right!==null,'reachable closed interval lost an endpoint');
    // A command safe at a boundary is safe throughout the adjacent open
    // cell: each unsafe interval is closed and all of its ends are cuts.
    // Both actions are safe at the shared midpoint when they differ.
    include(lo,m,left);
    include(m,hi,right);
  }
  return {regions};
}
export function planPositionDriftCatalog(source) {
  const catalog=parse(source), refusals=[];
  const contract={schema:CATALOG_SCHEMA, commands:catalog.commands.slice(), noiseBound:fmt(catalog.error),
    laws:catalog.ids.map((id,i)=>({id,rates:catalog.rates[i].map(fmt)}))};
  for (let a=0;a<catalog.commands.length;a++) for(let b=0;b<catalog.commands.length;b++){
    const result=inspect(catalog,a,b);
    if(result.regions) return {schema:policySchema,source:contract,status:'identified',first:catalog.commands[a],
      second:catalog.commands[b],regions:result.regions};
    refusals.push(result.collision);
  }
  return {schema:policySchema,source:contract,status:'impossible',refusals};
}

export function replayPositionDriftPolicy(source,policy) {
  const expected=planPositionDriftCatalog(source);
  need(same(expected,policy),'saved policy differs from prospective derivation');
  return expected;
}

export function observePositionDriftCatalog(source,policy,values) {
  replayPositionDriftPolicy(source,policy);
  need(policy.status==='identified','catalog has no guaranteed policy');
  need(Array.isArray(values) && values.length>=1 && values.length<=4,'supply one to four exact readings');
  const catalog=parse(source), ys=values.map(parseIntegratorReading), rounds=[], commands=[];
  for(let t=0;t<ys.length;t++){
    const surviving=states(catalog,commands,ys.slice(0,t+1));
    let next=null;
    if(surviving.length && t<3){
      if(t<2) next=t===0?policy.first:policy.second;
      else {
        const s=add(sub(ys[2],mul(two,ys[1])),ys[0]);
        const region=policy.regions.find(r=>contains(r.range.map(parseIntegratorReading),s));
        need(region,'feasible prefix missing from policy cover');
        next=region.command;
      }
    }
    rounds.push({tick:t,surviving,next});
    if(t+1<ys.length){
      need(next!==null,'a reading followed an impossible prefix');
      commands.push(catalog.commands.indexOf(next));
    }
  }
  return {schema:recordSchema,readings:ys.map(fmt),commands:commands.map(i=>catalog.commands[i]),rounds};
}
export function replayPositionDriftCatalog(source,policy,record) {
  need(record?.schema===recordSchema,'unrecognized record');
  const actual=observePositionDriftCatalog(source,policy,record.readings);
  need(same(actual,record),'saved transcript differs from exact replay');
  return actual;
}

// Exact pairwise overlap primitive for certificate consumers. Inputs are
// command-rate rows for three successive pulses, with repetition allowed.
export function projectedDriftOverlap(first,second,noiseBound) {
  need(Array.isArray(first) && first.length===3 && Array.isArray(second) && second.length===3,
    'expected two three-pulse rate rows');
  const error=parseSource(noiseBound);
  need(error.n>=0n,'noise bound must be nonnegative');
  const pair=[first,second].map(row=>response(row.map(parseSource),0,1,2,error));
  return joint(...pair)?.map(fmt) ?? null;
}

export {parse as parsePositionDriftRates, states as positionDriftStates, same as equalPositionDriftData};
