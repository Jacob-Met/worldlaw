/** Choose one fixed suffix after observing a fixed prefix of a persistent-state run. */
import {parsePositionDriftRates} from './persistent-position-drift-planner.mjs';
import {parseAllHorizonRational} from './persistent-position-drift-all-horizon.mjs';
import {certifyPositionDriftTape} from './persistent-position-drift-multiclass-minimum.mjs';
import {openPositionDriftFeedback} from './position-drift-terminal-feedback.mjs';

export const SUFFIX_REQUEST='worldlaw.position-drift-suffix-feedback-source/v1';
export const SUFFIX_PLAN='worldlaw.position-drift-suffix-feedback-policy/v1';
const need=(ok,reason)=>{if(!ok)throw Error('Suffix feedback: '+reason);};
const runs=word=>word.map(command=>({command,repeats:'1'}));

// Every physically possible survivor set lies in a maximal clique.
// Bron–Kerbosch uses a pivot to avoid enumerating all subsets of each clique.
function maximalCliques(neighbors){
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
  need(request?.schema===SUFFIX_REQUEST && Object.keys(request).sort().join(',')==='catalog,prefix,schema,suffixes',
    'supply a catalog, a fixed prefix and an ordered suffix menu');
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
  const cache=new Map(),cover=[];
  for(const clique of maximalCliques(neighbors)){
    clique.sort((a,b)=>a-b);
    const laws=clique.map(i=>ids[i]),failures=[];
    for(const [s,suffix] of suffixes.entries()){
      const proofs=[];
      let collision=null;
      for(let j=1;j<clique.length&&!collision;j++)for(let i=0;i<j;i++){
        const key=[s,clique[i],clique[j]].join(',');
        if(!cache.has(key))cache.set(key,pairTest(clique[i],clique[j],[...prefix,...suffix]));
        const result=cache.get(key);
        if(result.collision){collision=result.collision;break;}
        proofs.push(result.pairs[0]);
      }
      if(!collision){cover.push({laws,suffix:s,proofs});break;}
      failures.push({suffix:s,collision});
    }
    if(failures.length===suffixes.length)return {...base,status:'cover-inconclusive',prefixSeparations,uncovered:{laws,failures}};
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
  const row=plan.cover.find(r=>survivors.every(w=>r.laws.includes(w.law)));
  need(row,'the retained prefix is missing from the cover');
  const suffix=plan.suffixes[row.suffix],used=values.length-cut;
  const commands=[...prefix,...suffix.slice(0,used)];
  const witnesses=used?model.receive(commands,values):survivors;
  return {commands,witnesses,suffix:row.suffix,nextCommand:witnesses.length?(suffix[used]??null):null};
}
