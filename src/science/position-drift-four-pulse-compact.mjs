/** A sharp finite menu bound from elimination in causal tree order. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {compare} from './persistent-four-pulse-geometry.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {rateWorkBudget,RATE_WORK_EXHAUSTED} from './position-drift-rate-polytopes.mjs';
import {FOUR_PULSE_FEEDBACK_SOURCE,prepareFourPulseFeedback} from './position-drift-four-pulse-feedback-witness.mjs';
import {projectedFourPulseMenu,projectFourPulseRows} from './position-drift-four-pulse-projection.mjs';
import {verifyFourPulseMenuSupport,fourPulseCourseTree,buildFourPulseMenuProof,checkFourPulseMenuProof,receiveFourPulseMenu,fourPulseSourceSupport} from './position-drift-four-pulse-radius.mjs';
const {Q,add,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const one=Q(1n);
const need=(ok,msg)=>{if(!ok)throw Error('Four-pulse compact menu: '+msg);};
export const FOUR_PULSE_MENU_SOURCE='worldlaw.position-drift-four-pulse-menu/v1';
const schema='worldlaw.position-drift-four-pulse-compact-proof/v1';
const projectedSchema='worldlaw.position-drift-four-pulse-compact-proof/v2';

function prepare(request){
  if(request?.schema===FOUR_PULSE_FEEDBACK_SOURCE)return prepareFourPulseFeedback(request);
  need(request?.schema===FOUR_PULSE_MENU_SOURCE&&Object.keys(request).sort().join(',')==='branches,experiment,prefix,schema','supply a binary menu source');
  const out=prepareFourPulseFeedback({...request,schema:FOUR_PULSE_FEEDBACK_SOURCE,denominator:1});
  const source={...out.source,schema:FOUR_PULSE_MENU_SOURCE};delete source.denominator;return {...out,source};
}
function projectLast(rows,spend){
  const result=[];projectFourPulseRows(rows,spend,row=>result.push(row));return result;
}
function restrictedSupport(cat,prefix,menu,original,spend){
  const radius=rational(original.radius),tree=fourPulseCourseTree(cat,prefix,'full',spend,menu);
  if(!radius.n)return {kept:[0],lower:[]};
  const byLeaf=tree.leaves.map(()=>[]);
  for(const atom of original.lower){
    const n=atom.normal.map(rational),{word}=tree.leaves[atom.leaf],law=cat.ids.indexOf(atom.law);
    const {h,r}=fourPulseSourceSupport(cat,word,law,n,spend);
    byLeaf[atom.leaf].push({c:n,h,r,terms:[{atom,weight:one}]});
  }
  const byIntermediate=new Map();
  byLeaf.forEach((rows,i)=>{
    const branch=tree.leaves[i].coordinates[1];
    if(!byIntermediate.has(branch))byIntermediate.set(branch,[]);
    for(const row of projectLast(rows,spend))byIntermediate.get(branch).push(row);
  });
  const prefixRows=[];
  for(const rows of byIntermediate.values())for(const row of projectLast(rows,spend))prefixRows.push(row);
  const scalar=projectLast(prefixRows,spend).find(row=>row.r.n>0n&&!add(row.h,mul(radius,row.r)).n);
  need(scalar&&scalar.terms.length<=8,'no tight tree-ordered scalar support');
  const kept=[...new Set(scalar.terms.map(t=>t.atom.leaf))].sort((a,b)=>a-b);
  need(kept.length<=4,'support exceeds four leaves');
  return {kept,lower:scalar.terms.map(({atom,weight})=>({leaf:kept.indexOf(atom.leaf),law:atom.law,normal:atom.normal.slice(),weight:fmt(weight)}))};
}
function restrictedTree(cat,prefix,menu,kept,spend){
  const full=fourPulseCourseTree(cat,prefix,'full',spend,menu);
  need(Array.isArray(kept)&&kept.length>=1&&kept.length<=4&&kept.every((v,i)=>Number.isSafeInteger(v)&&v>=0&&v<full.leaves.length&&(!i||v>kept[i-1])),
    'invalid retained leaf indices');
  const byThird=new Map();
  for(const i of kept){
    const [, ,b,c]=full.leaves[i].word;if(!byThird.has(b))byThird.set(b,[]);byThird.get(b).push(c);
  }
  const branches=[...byThird].map(([third,last])=>({third,last})),small=fourPulseCourseTree(cat,prefix,'full',spend,branches);
  return {full,small,branches};
}
function proofs(cat,prefix,menu,saved,spend){
  const {full,small,branches}=restrictedTree(cat,prefix,menu,saved.kept,spend),boundary=saved.boundary;
  const observations=Array(small.width),worlds=[];
  need(boundary.observations.length===full.width&&boundary.worlds.length===full.leaves.length&&Array.isArray(saved.lower)&&saved.lower.length<=8,
    'incomplete original boundary or compact lower support');
  small.leaves.forEach((leaf,j)=>{
    const i=saved.kept[j],old=full.leaves[i];
    need(leaf.word.every((v,k)=>v===old.word[k]),'retained ancestry differs');
    leaf.coordinates.forEach((k,t)=>observations[k]=boundary.observations[old.coordinates[t]]);
    worlds.push(boundary.worlds[i]);
  });
  const base={prefix:prefix.map(i=>cat.commands[i]),radius:saved.radius};
  const compact={...base,lower:saved.lower,observations,worlds};
  const lifted=saved.lower.map(t=>{
    need(Number.isSafeInteger(t.leaf)&&t.leaf>=0&&t.leaf<saved.kept.length,'unknown compact support leaf');
    return {...t,leaf:saved.kept[t.leaf]};
  });
  return {branches,compact,original:{...base,...boundary,lower:lifted}};
}
export function compressFourPulseMenuWithSimplex(request){
  const {cat,source,prefix,menu}=prepare(request),work=rateWorkBudget(source.experiment.catalog.limits.designWork),base={schema,source};
  try{
    const original=buildFourPulseMenuProof(cat,prefix,menu,work.spend),{kept,lower}=restrictedSupport(cat,prefix,menu,original,work.spend);
    return {...base,status:'menu-compressed',radius:original.radius,kept,lower,
      boundary:{observations:original.observations,worlds:original.worlds},work:work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
}
export function compressFourPulseMenu(request){
  const {cat,source,prefix,menu}=prepare(request);
  if(menu.reduce((n,branch)=>n+branch.last.length,0)<=4)return compressFourPulseMenuWithSimplex(request);
  const work=rateWorkBudget(source.experiment.catalog.limits.designWork),base={schema:projectedSchema,source};
  try{return {...base,status:'menu-compressed',...projectedFourPulseMenu(cat,prefix,menu,work.spend),work:work.used};}
  catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {...base,status:'design-budget-exhausted',work:work.used};}
}
export function verifyCompactFourPulseMenu(request,saved){
  const {cat,source,prefix,menu}=prepare(request),work=rateWorkBudget(source.experiment.catalog.limits.designWork);
  need([schema,projectedSchema].includes(saved?.schema)&&equalPositionDriftData(saved.source,source),'source differs');
  if(saved.status==='design-budget-exhausted'){
    const rebuild=saved.schema===schema?compressFourPulseMenuWithSimplex:compressFourPulseMenu;
    need(equalPositionDriftData(rebuild(request),saved),'unreproducible exhaustion');return true;
  }
  need(saved.status==='menu-compressed'&&Number.isSafeInteger(saved.work)&&saved.work>=0&&saved.work<=source.experiment.catalog.limits.designWork,'invalid proof');
  try{
    const {branches,compact,original}=proofs(cat,prefix,menu,saved,work.spend);
    if(saved.schema===projectedSchema){
      let previous=Q(0n);need(Array.isArray(saved.jumps),'missing projected lower bounds');
      for(const jump of saved.jumps){
        const next=rational(jump.radius);need(compare(next,previous)>0&&jump.lower.length<=8,'invalid lower-bound progression');
        verifyFourPulseMenuSupport(cat,prefix,menu,next,jump.lower,work.spend);previous=next;
      }
      need(compare(previous,rational(saved.radius))===0&&equalPositionDriftData(saved.jumps.at(-1)?.lower??[],original.lower),'last projected support differs');
    }
    checkFourPulseMenuProof(cat,prefix,menu,original,work.spend);checkFourPulseMenuProof(cat,prefix,branches,compact,work.spend);
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;throw Error('Compact-menu replay exceeded source budget');}
  return true;
}
export function receiveCompactFourPulseMenu(request,saved,values){
  verifyCompactFourPulseMenu(request,saved);
  const {cat,source,prefix,menu}=prepare(request),work=rateWorkBudget(source.experiment.catalog.limits.receiverWork);
  need(saved.status==='menu-compressed'&&compare(cat.error,rational(saved.radius))<0&&Array.isArray(values),'no certified menu at this bound');
  try{
    const {branches}=restrictedTree(cat,prefix,menu,saved.kept,work.spend);
    return {...receiveFourPulseMenu(cat,prefix,branches,values,work.spend),work:work.used};
  }catch(e){if(e!==RATE_WORK_EXHAUSTED)throw e;return {status:'receiver-budget-exhausted',surviving:null,nextCommand:null,work:work.used};}
}

export function supportFourLeafBound(cat,prefix,menu,original,spend){return restrictedSupport(cat,prefix,menu,original,spend);}
export function checkFourLeafBound(cat,prefix,menu,original,support,spend){
  const saved={radius:original.radius,...support,boundary:{observations:original.observations,worlds:original.worlds}};
  const {branches,compact,original:lifted}=proofs(cat,prefix,menu,saved,spend);
  checkFourPulseMenuProof(cat,prefix,menu,lifted,spend);checkFourPulseMenuProof(cat,prefix,branches,compact,spend);
}
