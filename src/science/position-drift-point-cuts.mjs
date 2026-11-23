/** Physical disagreement cuts for exact zero-noise command support. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {openRateAlias} from './position-drift-rate-segments.mjs';
import {solveRateEqualities,compareRateHulls,mixRateRows,rateWorkBudget,RATE_WORK_EXHAUSTED,observeRatePolytopeSchedule} from './position-drift-rate-polytopes.mjs';
import {SUPPORT_PLAN,pointRateCatalog,replayReferenceBranch} from './position-drift-point-support.mjs';
const {Q,Z,add,sub,mul,div,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const one=Q(1n),sum=xs=>xs.reduce(add,Z()),dot=(a,b)=>sum(a.map((v,i)=>mul(v,b[i])));
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const need=(ok,message)=>{if(!ok)throw Error('Point-family disagreement cuts: '+message);};
export const CUT_SOURCE='worldlaw.position-drift-point-cuts-source/v1';
function sourceData(request){
  need(request?.schema===CUT_SOURCE&&Object.keys(request).sort().join(',')==='candidateLimit,catalog,hittingWork,schema'&&
    [request.candidateLimit,request.hittingWork].every(n=>Number.isSafeInteger(n)&&n>=0),'supply a point catalog and nonnegative candidate and hitting-work limits');
  return pointRateCatalog(request.catalog);
}

function separatorFor(data,ids,weights,spend){
  const {cat,reference,other}=data;
  need(ids.length&&weights.length===ids.length&&sum(weights).n===0n,'invalid zero-sum normal');
  const bands=[reference,other].map(f=>{
    const values=cat.vertices[f].map(row=>{spend();return dot(weights,ids.map(i=>row[i]));}).sort(cmp);
    return [values[0],values.at(-1)];
  });
  need(cmp(bands[0][0],bands[1][1])>0,'normal missed the closed physical hull');
  return {commands:ids.map(i=>cat.commands[i]),laws:[cat.ids[reference],cat.ids[other]],weights:weights.map(fmt),
    rateBands:bands.map(b=>b.map(fmt))};
}
function witnessFor(data,weights,shift,spend,knownRates){
  const {cat,reference,other}=data,ref=cat.vertices[reference][0];
  need(weights.length===cat.vertices[other].length&&weights.every(x=>x.n>=0n)&&cmp(sum(weights),one)===0,'invalid persistent competitor');
  const rates=knownRates??mixRateRows(cat.vertices[other],weights),disagreements=[];
  for(let i=0;i<ref.length;i++){spend();if(cmp(sub(ref[i],rates[i]),shift)!==0)disagreements.push(i);}
  return {disagreements,alias:{laws:[cat.ids[reference],cat.ids[other]],
    parameters:[cat.vertices[reference].map((_,i)=>i?'0':'1'),weights.map(fmt)],driftShift:fmt(shift)}};
}
function testCandidate(data,ids,spend){
  const {cat,reference,other}=data,ref=cat.vertices[reference][0],vertices=cat.vertices[other];
  const affineRows=[Array.from({length:ids.length},()=>one).concat(Z()),...vertices.map(row=>{
    spend();return [...ids.map(i=>sub(ref[i],row[i])),one];
  })];
  const normal=solveRateEqualities(affineRows,ids.length,spend);
  if(normal)return {method:'affine-separator',separator:separatorFor(data,ids,normal,spend)};
  const first=ids[0];
  const mixtureRows=[vertices.map(()=>one).concat(one),...ids.slice(1).map(i=>{
    spend();return [...vertices.map(row=>sub(row[i],row[first])),sub(ref[i],ref[first])];
  })];
  const weights=solveRateEqualities(mixtureRows,vertices.length,spend);
  if(weights&&weights.every(w=>w.n>=0n)){
    const rate=dot(weights,vertices.map(v=>v[first]));
    return {method:'affine-alias',cut:witnessFor(data,weights,sub(ref[first],rate),spend)};
  }
  const restricted=row=>ids.map(i=>row[i]);
  const r=compareRateHulls([restricted(ref)],vertices.map(restricted),spend);
  if(r.parameters)return {method:'convex-alias',cut:witnessFor(data,r.parameters[1].map(rational),rational(r.driftShift),spend)};
  return {method:'convex-separator',separator:separatorFor(data,ids,r.weights,spend)};
}

function insertCut(cuts,cut,spend){
  const subset=(left,right)=>{spend();return left.every(i=>right.includes(i));};
  if(cuts.some(old=>subset(old.disagreements,cut.disagreements)))return false;
  for(let i=cuts.length-1;i>=0;i--)if(subset(cut.disagreements,cuts[i].disagreements))cuts.splice(i,1);
  cuts.push(cut);cuts.sort((a,b)=>a.disagreements.length-b.disagreements.length);
  return true;
}

function hitDecision(cuts,active,left,spend,withProof){
  spend();if(!active.length)return {hit:[]};
  const packing=[],covered=new Set();
  for(const i of active){
    spend();const D=cuts[i].disagreements;
    if(D.some(c=>covered.has(c)))continue;
    packing.push(i);D.forEach(c=>covered.add(c));
    if(packing.length>left)return withProof?{proof:{packing}}:{};
  }
  if(packing.length===active.length)return {hit:active.map(i=>cuts[i].disagreements[0])};
  const pivot=active[0],children=[];
  for(const c of cuts[pivot].disagreements){
    const next=active.filter(i=>{spend();return !cuts[i].disagreements.includes(c);});
    const r=hitDecision(cuts,next,left-1,spend,withProof);
    if(r.hit)return {hit:[c,...r.hit]};
    if(withProof)children.push(r.proof);
  }
  return withProof?{proof:{pivot,children}}:{};
}
function minimumHittingSet(cuts,count,lower,spend){
  const active=cuts.map((_,i)=>i);
  const occupied=new Set();let disjoint=0;
  for(const {disagreements} of cuts){spend();if(disagreements.some(i=>occupied.has(i)))continue;
    disjoint++;disagreements.forEach(i=>occupied.add(i));
  }
  for(let k=Math.max(lower,disjoint);k<=count;k++){
    const r=hitDecision(cuts,active,k,spend,false);
    if(r.hit)return r.hit.sort((a,b)=>a-b);
  }
  throw Error('The complete command set failed to hit a nonempty disagreement.');
}

export function planPointCuts(request){
  const data=sourceData(request),{cat,reference,other,canonical}=data;
  const base={schema:SUPPORT_PLAN,method:'disagreement-cuts',source:canonical,referenceLaw:cat.ids[reference],
    candidateLimit:request.candidateLimit,hittingWorkLimit:request.hittingWork};
  const design=rateWorkBudget(canonical.limits.designWork),hitting=rateWorkBudget(request.hittingWork);
  const hitLimit=Symbol(),candidateLimit=Symbol();
  function spendHit(){try{hitting.spend();}catch(err){if(err!==RATE_WORK_EXHAUSTED)throw err;throw hitLimit;}}
  let seeds=0,candidates=0,lower=0;const cuts=[],history=[];
  const counts=()=>({seedWitnesses:seeds,candidatesTested:candidates,work:design.used,hittingWork:hitting.used});
  function aliasResult(alias){return {...base,status:'indistinguishable',aliases:[alias],...counts()};}
  try{
    const vertices=cat.vertices[other],ref=cat.vertices[reference][0];
    // Seed valid physical cuts using individual vertices and their barycenter.
    // A shift matching no command gives the full disagreement set and adds no information.
    for(let j=0;j<vertices.length+(vertices.length>1?1:0);j++){
      design.spend();const vertex=j<vertices.length;
      const weights=vertices.map((_,i)=>vertex?(i===j?one:Z()):Q(1n,BigInt(vertices.length)));
      const rate=vertex?vertices[j]:mixRateRows(vertices,weights),shifts=new Map();
      ref.forEach((v,i)=>{const shift=sub(v,rate[i]);shifts.set(fmt(shift),shift);});
      for(const shift of shifts.values()){
        const cut=witnessFor(data,weights,shift,design.spend,rate);seeds++;
        if(!cut.disagreements.length)return aliasResult(cut.alias);
        insertCut(cuts,cut,design.spend);
      }
    }
    for(;;){
      if(candidates>=request.candidateLimit)throw candidateLimit;
      const ids=minimumHittingSet(cuts,ref.length,lower,spendHit);lower=ids.length;
      candidates++;
      const result=testCandidate(data,ids,design.spend);
      history.push({commands:ids.map(i=>cat.commands[i]),result:result.method});
      if(result.cut){
        if(!result.cut.disagreements.length)return aliasResult(result.cut.alias);
        need(ids.every(c=>!result.cut.disagreements.includes(c))&&insertCut(cuts,result.cut,design.spend),'candidate alias failed to add a stronger physical cut');
        continue;
      }
      const cover=hitDecision(cuts,cuts.map((_,i)=>i),ids.length-1,spendHit,true);
      need(cover.proof,'the winning candidate was not a minimum hitting set');
      const runs=result.separator.commands.map(command=>({command,repeats:'1'}));
      return {...base,status:'minimum-certified',minimumPulses:String(ids.length),pulseUpperBound:String(ids.length),
        cuts,lowerProof:cover.proof,separator:result.separator,history,runs,readAt:Array.from({length:ids.length+1},(_,i)=>String(i)),...counts()};
    }
  }catch(err){
    if(err!==candidateLimit&&err!==hitLimit&&err!==RATE_WORK_EXHAUSTED)throw err;
    return {...base,status:'design-budget-exhausted',reason:err===candidateLimit?'candidates':err===hitLimit?'hitting-work':'linear-work',
      provedLower:String(lower),history,...counts()};
  }
}

/** The lower bound uses only physical witnesses and an integer cover proof. */
export function verifyPointCuts(request,saved){
  const data=sourceData(request),{cat,reference,other,canonical}=data;
  need(saved?.schema===SUPPORT_PLAN&&saved.method==='disagreement-cuts'&&saved.status==='minimum-certified'&&
    saved.referenceLaw===cat.ids[reference]&&equalPositionDriftData(saved.source,canonical)&&
    saved.candidateLimit===request.candidateLimit&&saved.hittingWorkLimit===request.hittingWork,'source or method differs');
  const {cuts,separator}=saved,lower=saved.lowerProof,spend=rateWorkBudget(canonical.limits.designWork).spend;
  need(Array.isArray(cuts)&&cuts.length>0&&cuts.length<=canonical.limits.designWork+request.candidateLimit,'invalid physical cut count');
  for(const cut of cuts){
    const a=cut.alias,weights=a.parameters[1].map(rational);
    const rebuilt=witnessFor(data,weights,rational(a.driftShift),spend);
    need(rebuilt.disagreements.length>0&&equalPositionDriftData(cut,rebuilt),'physical disagreement set differs');
  }
  const ids=separator.commands.map(c=>cat.commands.indexOf(c));
  need(ids.length>=2&&ids.every((c,i)=>c>=0&&(!i||c>ids[i-1]))&&saved.minimumPulses===String(ids.length)&&
    saved.pulseUpperBound===saved.minimumPulses,'invalid command subset or minimum');
  const upper=separatorFor(data,ids,separator.weights.map(rational),spend);
  need(equalPositionDriftData(separator,upper)&&equalPositionDriftData(saved.runs,upper.commands.map(command=>({command,repeats:'1'})))&&
    equalPositionDriftData(saved.readAt,Array.from({length:ids.length+1},(_,i)=>String(i))),'separating tape differs');
  const hitBudget=rateWorkBudget(request.hittingWork);
  function check(node,used,left){
    hitBudget.spend();
    const untouched=i=>Number.isSafeInteger(i)&&i>=0&&i<cuts.length&&cuts[i].disagreements.every(c=>!used.has(c));
    if(Array.isArray(node?.packing)){
      need(node.packing.length>left&&node.packing.length<=cuts.length,'insufficient disjoint lower witnesses');
      const seen=new Set();
      for(const i of node.packing){need(untouched(i),'packing contains an already hit or absent cut');
        for(const c of cuts[i].disagreements){need(!seen.has(c),'lower cuts overlap');seen.add(c);}
      }
      return;
    }
    need(left>0&&untouched(node?.pivot)&&Array.isArray(node.children),'invalid lower-proof branch');
    const D=cuts[node.pivot].disagreements;
    need(node.children.length===D.length,'missing candidate branch in hitting proof');
    D.forEach((c,i)=>check(node.children[i],new Set([...used,c]),left-1));
  }
  check(lower,new Set(),ids.length-1);
  return true;
}

export function openPointCuts(request,policy){
  const plan=planPointCuts(request);need(equalPositionDriftData(policy,plan),'saved candidate search differs from source');
  const data=sourceData(request),{cat,reference}=data;
  const ratesFor=(id,ws)=>mixRateRows(cat.vertices[cat.ids.indexOf(id)],ws.map(rational));
  if(plan.status==='indistinguishable')return openRateAlias(plan,cat.commands,ratesFor);
  need(plan.status==='minimum-certified','design work ended without a minimum');verifyPointCuts(request,plan);
  const referenceAdversary=(origin=['0','0'])=>replayReferenceBranch(cat,reference,plan.separator.commands.length,used=>{
    const cut=plan.cuts.find(c=>c.disagreements.every(i=>!used.has(cat.commands[i])));
    return cut&&{alias:cut.alias,commands:cat.commands.filter((_,i)=>!cut.disagreements.includes(i))};
  },ratesFor,origin);
  const observe=values=>observeRatePolytopeSchedule(plan,values);
  return {referenceAdversary,observe,replay:record=>{
    const actual=observe(record.readings);need(equalPositionDriftData(actual,record),'saved physical region differs from measurements');return actual;
  }};
}
