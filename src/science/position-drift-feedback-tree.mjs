/** Repeated measurement-led choices on one persistent physical trajectory. */
import {parsePositionDriftRates} from './persistent-position-drift-planner.mjs';
import {parseAllHorizonRational} from './persistent-position-drift-all-horizon.mjs';
import {certifyPositionDriftTape} from './persistent-position-drift-multiclass-minimum.mjs';
import {openPositionDriftFeedback} from './position-drift-terminal-feedback.mjs';
import {maximalCliques} from './position-drift-suffix-feedback.mjs';

export const TREE_REQUEST='worldlaw.position-drift-feedback-tree-source/v1';
import {TREE_PLAN,compileTree} from './position-drift-feedback-program.mjs';
import {EXACT_TREE_REQUEST,planExactFeedbackTree,receiveExactFeedbackTree} from './position-drift-exact-feedback-tree.mjs';
export {TREE_PLAN,EXACT_TREE_REQUEST};
const need=(ok,msg)=>{if(!ok)throw Error('Feedback tree: '+msg);};


export function planFeedbackTree(request){
  if(request?.schema===EXACT_TREE_REQUEST)return planExactFeedbackTree(request);
  need(request?.schema===TREE_REQUEST&&Object.keys(request).sort().join(',')==='catalog,program,schema,subproblems'&&
    Number.isSafeInteger(request.subproblems)&&request.subproblems>=0,'supply a program, rate catalog and a nonnegative subproblem budget');
  const source=structuredClone(request.catalog),cat=parsePositionDriftRates(source,parseAllHorizonRational);
  need(cat.ids.length<=16,'at most sixteen laws per tree');
  const {root,horizon}=compileTree(request.program,cat.commands),tables=[],memo=new Map(),pairs=new Map();
  const work={subproblems:0},exhausted=Symbol(),base={schema:TREE_PLAN,source,horizon,subproblems:request.subproblems,work,tables};
  function solve(node,ids){
    const key=node.id+'|'+ids.join(',');
    if(memo.has(key))return memo.get(key);
    if(work.subproblems>=request.subproblems)throw exhausted;
    work.subproblems++;
    const runs=node.word.map(command=>({command,repeats:'1'})),neighbors=ids.map(()=>new Set()),separations=[];
    let firstCollision=null;
    for(let j=1;j<ids.length;j++)for(let i=0;i<j;i++){
      const pairKey=[node.id,ids[i],ids[j]].join(',');
      if(!pairs.has(pairKey))pairs.set(pairKey,certifyPositionDriftTape({...source,laws:[source.laws[ids[i]],source.laws[ids[j]]]},runs));
      const result=pairs.get(pairKey);
      if(result.collision){neighbors[i].add(j);neighbors[j].add(i);firstCollision??=result.collision;}
      else separations.push(result.pairs[0]);
    }
    const row={node:node.id,commands:node.commands,laws:ids.map(i=>cat.ids[i]),separations};
    if(!node.alternatives.length){
      row.status=firstCollision?'uncovered-leaf':'separating-leaf';
      if(firstCollision)row.collision=firstCollision;
    }else{
      row.status='covered';row.groups=[];
      for(const clique of maximalCliques(neighbors)){
        const possible=clique.map(i=>ids[i]).sort((a,b)=>a-b),attempts=[];
        const group={laws:possible.map(i=>cat.ids[i])};
        for(const [choice,child] of node.alternatives.entries()){
          const table=solve(child,possible);attempts.push(table);
          if(['covered','separating-leaf'].includes(tables[table].status)){
            group.choice=choice;group.table=table;break;
          }
        }
        if(group.table===undefined){row.status='uncovered-group';row.uncovered={laws:group.laws,attempts};break;}
        row.groups.push(group);
      }
    }
    const index=tables.push(row)-1;memo.set(key,index);return index;
  }
  try{
    const entry=solve(root,cat.ids.map((_,i)=>i)),ok=['covered','separating-leaf'].includes(tables[entry].status);
    return {...base,entry,status:ok?'tree-certified':'tree-inconclusive'};
  }catch(e){if(e!==exhausted)throw e;return {...base,status:'tree-budget-exhausted'};}
}

export function receiveFeedbackTree(plan,values){
  if(plan.nodes)return receiveExactFeedbackTree(plan,values);
  need(plan.status==='tree-certified'&&Array.isArray(values)&&values.length>=1&&values.length<=plan.horizon+1,
    'supply consecutive positions from a certified course');
  const model=openPositionDriftFeedback(plan.source),decisions=[];
  let table=plan.entry,committed=[];
  for(;;){
    const row=plan.tables[table];
    committed=committed.concat(row.commands);
    const count=Math.min(committed.length+1,values.length),commands=committed.slice(0,count-1);
    const witnesses=model.receive(commands,values.slice(0,count));
    if(!witnesses.length||count<=committed.length||row.status==='separating-leaf'){
      need(count===values.length,'there is no continuation from an inconsistent history');
      return {commands,committed,decisions,witnesses,nextCommand:witnesses.length?(committed[count-1]??null):null};
    }
    const group=row.groups.find(g=>witnesses.every(w=>g.laws.includes(w.law)));
    need(group,'the measured laws are missing from the decision table');
    decisions.push({tick:String(committed.length),choice:group.choice});
    table=group.table;
    // The next committed segment is recorded before its first position is received.
  }
}
