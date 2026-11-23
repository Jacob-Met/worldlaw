/** Choose one fixed suffix after observing a fixed prefix of a persistent-state run. */
import {parsePositionDriftRates} from './persistent-position-drift-planner.mjs';
import {parseAllHorizonRational} from './persistent-position-drift-all-horizon.mjs';
import {certifyPositionDriftTape} from './persistent-position-drift-multiclass-minimum.mjs';
import {openPositionDriftFeedback} from './position-drift-terminal-feedback.mjs';

import {SUFFIX_PLAN,REGION_SUFFIX_REQUEST,planSuffixRegions,chooseRegionSuffix} from './position-drift-suffix-regions.mjs';
import {PLANAR_SUFFIX_REQUEST,planPlanarSuffix,choosePlanarSuffix} from './position-drift-planar-suffix.mjs';
import {SHARED_SUFFIX_REQUEST,planSharedSuffix,chooseSharedSuffix} from './position-drift-shared-suffix.mjs';
import {prefixHistoryOracle} from './position-drift-prefix-intersection.mjs';

export const HISTORY_SUFFIX_REQUEST='worldlaw.position-drift-suffix-feedback-source/v2';
export const SUFFIX_REQUEST='worldlaw.position-drift-suffix-feedback-source/v1';
export {SUFFIX_PLAN,REGION_SUFFIX_REQUEST,PLANAR_SUFFIX_REQUEST,SHARED_SUFFIX_REQUEST};
const need=(ok,reason)=>{if(!ok)throw Error('Suffix feedback: '+reason);};
const runs=word=>word.map(command=>({command,repeats:'1'}));

// Every physically possible survivor set lies in a maximal clique.
// Bron–Kerbosch uses a pivot to avoid enumerating all subsets of each clique.
export function maximalCliques(neighbors){
  const found=[];
  function visit(clique,possible,excluded){
    if(!possible.size&&!excluded.size){found.push(clique);return;}
    const candidates=[...possible,...excluded];
    const pivot=candidates.reduce((best,v)=>neighbors[v].size>neighbors[best].size?v:best);
    for(const v of [...possible].filter(v=>!neighbors[pivot].has(v))){
      const adjacent=set=>new Set([...set].filter(i=>neighbors[v].has(i)));
      visit([...clique,v],adjacent(possible),adjacent(excluded));
      possible.delete(v);excluded.add(v);
    }
  }
  visit([],new Set(neighbors.keys()),new Set());
  return found;
}

export function planSuffixFeedback(request){
  if(request?.schema===SHARED_SUFFIX_REQUEST)return planSharedSuffix(request);
  if(request?.schema===PLANAR_SUFFIX_REQUEST)return planPlanarSuffix(request);
  if(request?.schema===REGION_SUFFIX_REQUEST)return planSuffixRegions(request);
  const higher=request?.schema===HISTORY_SUFFIX_REQUEST;
  need((higher||request?.schema===SUFFIX_REQUEST) && Object.keys(request).sort().join(',')===(higher?
    'catalog,limits,prefix,schema,suffixes':'catalog,prefix,schema,suffixes'),
    'supply a catalog, a fixed prefix, an ordered suffix menu and the limits for the selected schema');
  if(higher)need(request.limits&&Object.keys(request.limits).sort().join(',')==='linearWork,subsets'&&
    Object.values(request.limits).every(v=>Number.isSafeInteger(v)&&v>=0),'supply nonnegative subset and linear-work budgets');
  const source=structuredClone(request.catalog),{ids,commands}=parsePositionDriftRates(source,parseAllHorizonRational);
  need(ids.length<=16,'at most 16 laws per cover');
  const validWord=word=>Array.isArray(word)&&word.length>0&&word.every(u=>commands.includes(u));
  need(validWord(request.prefix)&&Array.isArray(request.suffixes)&&request.suffixes.length>=1&&request.suffixes.length<=16,
    'supply a nonempty prefix and between one and 16 suffixes');
  const prefix=request.prefix.slice(),suffixes=structuredClone(request.suffixes);
  need(suffixes.every(word=>validWord(word)&&word.length===suffixes[0].length&&prefix.length+word.length<=12),
    'use equal positive suffix lengths and at most 12 total pulses');
  const base={schema:SUFFIX_PLAN,source,prefix,suffixes};
  const neighbors=ids.map(()=>new Set()),prefixSeparations=[];
  const pairTest=(i,j,word)=>certifyPositionDriftTape({...source,laws:[source.laws[i],source.laws[j]]},runs(word));
  for(let j=1;j<ids.length;j++)for(let i=0;i<j;i++){
    const result=pairTest(i,j,prefix);
    if(result.status==='fixed-tape-collision'){neighbors[i].add(j);neighbors[j].add(i);}
    else prefixSeparations.push(result.pairs[0]);
  }
  const cache=new Map(),cover=[],visited=new Set();
  const work={subsets:0,linearWork:0},eliminations=[];
  const checkHistory=higher?prefixHistoryOracle(source,prefix):null;
  if(higher)Object.assign(base,{limits:{...request.limits},work,eliminations});
  const exhausted=Symbol();
  function spend(kind){
    if(work[kind]>=request.limits[kind])throw exhausted;
    work[kind]++;
  }
  function inspect(clique){
    clique.sort((a,b)=>a-b);
    const key=clique.join(',');
    if(visited.has(key))return;
    visited.add(key);
    if(higher)spend('subsets');
    const laws=clique.map(i=>ids[i]),failures=[];
    for(const [s,suffix] of suffixes.entries()){
      const proofs=[];
      let collision=null;
      for(let j=1;j<clique.length&&!collision;j++)for(let i=0;i<j;i++){
        const pairKey=[s,clique[i],clique[j]].join(',');
        if(!cache.has(pairKey))cache.set(pairKey,pairTest(clique[i],clique[j],[...prefix,...suffix]));
        const result=cache.get(pairKey);
        if(result.collision){collision=result.collision;break;}
        proofs.push(result.pairs[0]);
      }
      if(!collision){cover.push({laws,suffix:s,proofs});return;}
      failures.push({suffix:s,collision});
    }
    if(!higher)return {laws,failures};
    const common=checkHistory(clique,()=>spend('linearWork'));
    if(common.readings)return {laws,failures,commonPrefix:common};
    // A physically realizable subset omits at least one member of the
    // contradiction's support. Branch only on that support.
    eliminations.push({laws,excluded:common.excluded.map(i=>ids[i]),proof:common.proof});
    for(const missing of common.excluded){
      const failed=inspect(clique.filter(i=>i!==missing));
      if(failed)return failed;
    }
  }
  try{
    for(const clique of maximalCliques(neighbors)){
      const uncovered=inspect(clique);
      if(uncovered)return {...base,status:'cover-inconclusive',prefixSeparations,uncovered};
    }
  }catch(e){
    if(e!==exhausted)throw e;
    return {...base,status:'cover-budget-exhausted',prefixSeparations};
  }
  return {...base,status:'suffix-certified',prefixSeparations,cover};
}

/** Replay commits the suffix from the prefix alone, including on the final tick. */
export function receiveSuffixFeedback(plan,values){
  need(plan.status==='suffix-certified'&&Array.isArray(values)&&values.length>0,'supply a certified policy and retained readings');
  const model=openPositionDriftFeedback(plan.source),cut=plan.prefix.length+1;
  need(values.length<=cut+plan.suffixes[0].length,'readings extend past the registered suffix');
  const prefix=plan.prefix.slice(0,Math.min(values.length,cut)-1);
  const survivors=model.receive(prefix,values.slice(0,cut));
  if(values.length<cut||!survivors.length){
    need(values.length<=cut,'no command follows an inconsistent prefix');
    return {commands:prefix,witnesses:survivors,suffix:null,nextCommand:survivors.length?(plan.prefix[prefix.length]??null):null};
  }
  const selected=plan.candidates?chooseSharedSuffix(plan,values,survivors):plan.polygons?choosePlanarSuffix(plan.polygons,values):plan.regions?chooseRegionSuffix(plan.regions,values):
    plan.cover.find(r=>survivors.every(w=>r.laws.includes(w.law)))?.suffix;
  need(selected!==undefined,'the retained prefix is missing from the policy');
  const suffix=plan.suffixes[selected],used=values.length-cut;
  const commands=[...prefix,...suffix.slice(0,used)];
  const witnesses=used?model.receive(commands,values):survivors;
  return {commands,witnesses,suffix:selected,nextCommand:witnesses.length?(suffix[used]??null):null};
}
