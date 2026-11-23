/** Counterfactual observation histories for a declared, finite feedback tree. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {parsePositionDriftRates,equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {certifyPositionDriftTape} from './persistent-position-drift-multiclass-minimum.mjs';
import {openPositionDriftFeedback} from './position-drift-terminal-feedback.mjs';
import {feedbackPrimitive,intersectFeedbackHalfspaces,checkFeedbackContradiction} from './exact-feedback-feasibility.mjs';
import {TREE_PLAN,compileTree} from './position-drift-feedback-program.mjs';

const {Q,Z,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const need=(ok,msg)=>{if(!ok)throw Error('Exact feedback tree: '+msg);};
export const EXACT_TREE_REQUEST='worldlaw.position-drift-feedback-tree-source/v2';

function prepare(request){
  need(request?.schema===EXACT_TREE_REQUEST&&Object.keys(request).sort().join(',')==='catalog,limits,program,schema',
    'supply a catalog, a finite command program and search limits');
  const source=structuredClone(request.catalog),cat=parsePositionDriftRates(source,rational),limits=request.limits;
  need(limits&&Object.keys(limits).sort().join(',')==='assignments,linearWork'&&Object.values(limits).every(n=>Number.isSafeInteger(n)&&n>=0),
    'supply nonnegative assignment and linear-work limits');
  const {root,horizon}=compileTree(request.program,cat.commands);
  need(cat.ids.length<=4&&horizon<=12,'at most four laws and twelve pulses per path');
  const nodes=[],candidates={};
  let nextMark=1;
  function visit(node,inherited){
    const marks=[...inherited,...node.commands.map(()=>nextMark++)];
    const record={commands:node.commands,word:node.word,marks,children:node.alternatives.map(x=>x.id),leaves:[]};
    nodes[node.id]=record;
    if(node.alternatives.length){
      record.leaves=node.alternatives.flatMap(child=>visit(child,marks));
    }else{
      record.leaves=[node.id];candidates[node.id]=[];
      const runs=node.word.map(command=>({command,repeats:'1'}));
      for(let j=1;j<cat.ids.length;j++)for(let i=0;i<j;i++){
        const r=certifyPositionDriftTape({...source,laws:[source.laws[i],source.laws[j]]},runs);
        if(r.collision)candidates[node.id].push([i,j]);
      }
    }
    return record.leaves;
  }
  visit(root,[0]);
  need(nodes[0].leaves.length<=4,'at most four terminal paths');
  return {source,cat,limits,nodes,candidates,horizon};
}

// One variable belongs to one observation on one program segment. All its
// descendant leaves share it; sibling segments have private continuations.
function observedRows(course,leaves,pairs,fixed,spend){
  const {cat,nodes}=course,variables=new Map();
  for(const leaf of leaves)for(const mark of nodes[leaf].marks){
    if(!fixed.has(mark)&&!variables.has(mark))variables.set(mark,variables.size);
  }
  const width=variables.size,rows=[];
  for(const [l,leaf] of leaves.entries())for(const law of pairs[l]){
    const {marks,word}=nodes[leaf],f=[Z()];
    for(const u of word)f.push(add(f.at(-1),cat.rates[law][cat.commands.indexOf(u)]));
    for(let k=2;k<f.length;k++)for(let j=1;j<k;j++)for(let i=0;i<j;i++){
      const ticks=[i,j,k],w=[BigInt(k-j),BigInt(i-k),BigInt(j-i)],radius=mul(Q(2n*BigInt(k-i)),cat.error);
      for(const sign of [-1n,1n]){
        spend();
        const a=Array(width).fill(0n);
        let b=radius;
        for(const [n,t] of ticks.entries()){
          const weight=sign*w[n],mark=marks[t];
          b=add(b,mul(Q(weight),f[t]));
          if(fixed.has(mark))b=sub(b,mul(Q(weight),fixed.get(mark)));
          else a[variables.get(mark)]=weight;
        }
        rows.push(feedbackPrimitive(a,b));
      }
    }
  }
  return {rows,width,variables};
}

function witnesses(course,leaves,pairs,assigned){
  const physical=openPositionDriftFeedback(course.source);
  return leaves.map((leaf,i)=>{
    const {marks,word}=course.nodes[leaf],readings=marks.map(mark=>fmt(assigned.get(mark)));
    const survivors=physical.receive(word,readings);
    const worlds=pairs[i].map(k=>survivors.find(w=>w.law===course.cat.ids[k]));
    need(worlds.every(Boolean),'a reported branch has no persistent physical start');
    return {leaf,commands:word.slice(),readings,worlds};
  });
}

function adversary(course,leaves,fixed,spend,exclusions,wantWorlds){
  if(leaves.some(leaf=>!course.candidates[leaf].length))return null;
  function search(pairs){
    if(pairs.length){
      spend('assignments');
      const prefix=leaves.slice(0,pairs.length),linear=()=>spend('linearWork');
      const p=observedRows(course,prefix,pairs,fixed,linear),r=intersectFeedbackHalfspaces(p.rows,p.width,linear);
      if(r.proof){
        if(exclusions){
          need(checkFeedbackContradiction(p.rows,p.width,r.proof),'invalid weighted history contradiction');
          exclusions.push({pairs:pairs.map(x=>x.slice()),proof:r.proof.map(([i,w])=>[i,String(w)])});
        }
        return null;
      }
      if(pairs.length===leaves.length){
        if(!wantWorlds)return true;
        const assigned=new Map(fixed);
        for(const [mark,i] of p.variables)assigned.set(mark,r.point[i]);
        return witnesses(course,leaves,pairs,assigned);
      }
    }
    for(const pair of course.candidates[leaves[pairs.length]]){
      const found=search([...pairs,pair]);if(found)return found;
    }
    return null;
  }
  return search([]);
}

function initialGauge(nodes){
  return new Map(nodes[0].marks.slice(0,2).map(mark=>[mark,Z()]));
}

export function planExactFeedbackTree(request){
  const c=prepare(request),work={assignments:0,linearWork:0},exclusions=[];
  const base={schema:TREE_PLAN,source:c.source,horizon:c.horizon,nodes:c.nodes,candidates:c.candidates,limits:{...c.limits},work,exclusions};
  const exhausted=Symbol(),spend=k=>{if(work[k]>=c.limits[k])throw exhausted;work[k]++;};
  try{
    const collision=adversary(c,c.nodes[0].leaves,initialGauge(c.nodes),spend,exclusions,true);
    return collision?{...base,status:'tree-refuted',collision}:{...base,status:'tree-certified'};
  }catch(e){if(e!==exhausted)throw e;return {...base,status:'tree-budget-exhausted'};}
}

/** Replay uses only observations already available at each branch point. */
export function receiveExactFeedbackTree(plan,values){
  need(plan.status==='tree-certified'&&Array.isArray(values)&&values.length>=1&&values.length<=plan.horizon+1,
    'supply consecutive readings on a certified tree');
  const physical=openPositionDriftFeedback(plan.source),cat=parsePositionDriftRates(plan.source,rational);
  const course={source:plan.source,nodes:plan.nodes,candidates:plan.candidates,cat},decisions=[];
  let current=0;
  for(;;){
    const node=plan.nodes[current],n=Math.min(values.length,node.marks.length);
    const commands=node.word.slice(0,n-1),w=physical.receive(commands,values.slice(0,n));
    if(!w.length||n<node.marks.length||!node.children.length){
      need(n===values.length,'no continuation follows an inconsistent history');
      return {commands,witnesses:w,committed:node.word.slice(),decisions,nextCommand:w.length?(node.word[n-1]??null):null};
    }
    const fixed=new Map(node.marks.map((mark,i)=>[mark,rational(values[i])]));
    const retained=new Set(w.map(state=>state.law));
    const candidates=Object.fromEntries(node.leaves.map(id=>[id,plan.candidates[id].filter(pair=>pair.every(k=>retained.has(cat.ids[k])))]));
    const conditional={...course,candidates};
    const choice=node.children.findIndex(id=>!adversary(conditional,plan.nodes[id].leaves,fixed,()=>{},null,false));
    need(choice>=0,'the actual history has no winning continuation');
    decisions.push({tick:String(node.word.length),choice});current=node.children[choice];
  }
}

// A different receiver can check a winning tree by substitution without an LP search.
export function verifyExactFeedbackTree(request,saved){
  const c=prepare(request),leaves=c.nodes[0].leaves;
  need(saved?.schema===TREE_PLAN&&saved.status==='tree-certified'&&saved.horizon===c.horizon&&equalPositionDriftData(saved.source,c.source)&&
    equalPositionDriftData(saved.nodes,c.nodes)&&equalPositionDriftData(saved.candidates,c.candidates)&&
    equalPositionDriftData(saved.limits,c.limits)&&Array.isArray(saved.exclusions),'certificate source or program differs');
  if(leaves.some(l=>!c.candidates[l].length)){
    need(!saved.exclusions.length,'a constant successful path has unused exclusions');return true;
  }
  const proofs=new Map(saved.exclusions.map(x=>[JSON.stringify(x.pairs),x.proof]));
  need(proofs.size===saved.exclusions.length&&proofs.size<=c.limits.assignments,'duplicate or excessive assignment exclusions');
  const fixed=initialGauge(c.nodes);
  let used=0,visits=0,linear=0;
  function cover(pairs){
    if(pairs.length)need(++visits<=c.limits.assignments,'assignment coverage exceeds its budget');
    const key=JSON.stringify(pairs);
    if(pairs.length&&proofs.has(key)){
      const terms=proofs.get(key);
      need(Array.isArray(terms)&&terms.length&&terms.every(t=>Array.isArray(t)&&t.length===2&&
        typeof t[1]==='string'&&/^[1-9][0-9]*$/.test(t[1])),'malformed contradiction weight');
      const p=observedRows(c,leaves.slice(0,pairs.length),pairs,fixed,()=>need(++linear<=c.limits.linearWork,'row budget exceeded'));
      need(checkFeedbackContradiction(p.rows,p.width,terms.map(([i,w])=>[i,BigInt(w)])),'physical inequalities do not contradict');
      used++;return;
    }
    need(pairs.length<leaves.length,'missing terminal assignment exclusion');
    for(const pair of c.candidates[leaves[pairs.length]])cover([...pairs,pair]);
  }
  cover([]);need(used===proofs.size,'unused assignment exclusion');return true;
}
