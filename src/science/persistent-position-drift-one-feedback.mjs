/** Bounded prospective search over declared fixed prefixes and one final feedback choice. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational} from './persistent-position-drift-all-horizon.mjs';
import {parsePositionDriftRates,equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {openPositionDriftFeedback,selectSafePositionDriftCommand} from './position-drift-terminal-feedback.mjs';
import {feedbackPrimitive,intersectFeedbackHalfspaces,checkFeedbackContradiction} from './exact-feedback-feasibility.mjs';

const {Q,Z,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
export const ONE_FEEDBACK_REQUEST='worldlaw.position-drift-one-feedback-source/v1';
export const ONE_FEEDBACK_PLAN='worldlaw.position-drift-one-feedback-policy/v1';
const need=(ok,m)=>{if(!ok)throw Error('One-feedback planner: '+m);};
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...names].sort().join(',');

function parse(request){
  need(keys(request,['schema','catalog','prefixes','limits'])&&request.schema===ONE_FEEDBACK_REQUEST,'expected a declared catalog, prefix list and limits');
  const cat=parsePositionDriftRates(request.catalog,parseAllHorizonRational);
  need(Array.isArray(request.prefixes)&&request.prefixes.length>0&&
    request.prefixes.every(p=>Array.isArray(p)&&p.every(u=>cat.commands.includes(u))),'offer at least one valid command prefix');
  const limits=request.limits;
  need(keys(limits,['assignments','linearWork'])&&Object.values(limits).every(x=>Number.isSafeInteger(x)&&x>=0),
    'declare nonnegative safe integer assignment and linear-work budgets');
  return cat;
}

function inequalities(cat,prefix,choices,spend){
  // Subtract y0+t*(y1-y0) from every branch. Both terms translate the
  // unknown starting state, so y0=y1=0 loses no shared-prefix witness.
  // With an empty prefix fix only y0; the final coordinates stay private.
  const shared=Math.max(0,prefix.length-1),width=shared+cat.commands.length;
  const rows=[],final=prefix.length+1,indices=prefix.map(u=>cat.commands.indexOf(u));
  for(let action=0;action<choices.length;action++)for(const law of choices[action]){
    const forcing=[Z()];let total=Z();
    for(const u of [...indices,action]){total=add(total,cat.rates[law][u]);forcing.push(total);}
    for(let k=2;k<=final;k++)for(let j=1;j<k;j++)for(let i=0;i<j;i++){
      const ticks=[i,j,k],weights=[BigInt(k-j),BigInt(i-k),BigInt(j-i)];
      const center=ticks.reduce((s,t,n)=>add(s,mul(Q(weights[n]),forcing[t])),Z());
      const radius=mul(Q(2n*BigInt(k-i)),cat.error);
      for(const sign of [-1n,1n]){
        spend();
        const a=Array(width).fill(0n);
        ticks.forEach((t,n)=>{if(t===final)a[shared+action]+=sign*weights[n];else if(t>=2)a[t-2]+=sign*weights[n];});
        rows.push(feedbackPrimitive(a,add(radius,mul(Q(sign),center))));
      }
    }
  }
  return {rows,width,shared};
}

function physicalCollision(source,prefix,choices,cat,solution,shared){
  const physical=openPositionDriftFeedback(source);
  const readings=Array(Math.min(prefix.length+1,2)).fill('0').concat(solution.slice(0,shared).map(fmt));
  const branches=cat.commands.map((command,u)=>{
    const finalReading=fmt(solution[shared+u]);
    const survivors=physical.receive([...prefix,command],[...readings,finalReading]);
    const worlds=choices[u].map(i=>survivors.find(w=>w.law===cat.ids[i]));
    need(worlds.every(Boolean),'counterexample failed original physical replay');
    return {command,finalReading,worlds};
  });
  return {readings,branches};
}

function pairAt(index){
  // Pairs are in triangular order (0,1), (0,2), (1,2), ...
  let j=Math.floor((1+Math.sqrt(1+8*index))/2);
  while(j*(j-1)/2>index)j--;
  while(j*(j+1)/2<=index)j++;
  return [index-j*(j-1)/2,j];
}
function advance(digits,base){
  for(let i=0;i<digits.length;i++){
    if(++digits[i]<base)return true;
    digits[i]=0;
  }
  return false;
}

function canonicalCatalog(request,cat){
  return {schema:request.catalog.schema,commands:cat.commands.slice(),noiseBound:fmt(cat.error),
    laws:cat.ids.map((id,i)=>({id,rates:cat.rates[i].map(fmt)}))};
}

export function planOneFeedback(request){
  const cat=parse(request);
  const source=canonicalCatalog(request,cat);
  const {assignments,linearWork}=request.limits,work={assignments:0,linearWork:0};
  const base={schema:ONE_FEEDBACK_PLAN,source,limits:{assignments,linearWork},work,trials:[]};
  // Pair numbers follow increasing catalogue indices and action digits
  // follow source command order. Never materialize the Cartesian product.
  const pairCount=cat.ids.length*(cat.ids.length-1)/2;
  need(Number.isSafeInteger(pairCount),'catalog pair indices exceed exact integer range');
  const exhausted=Symbol();
  const spend=()=>{if(work.linearWork>=linearWork)throw exhausted;work.linearWork++;};
  for(const prefix of request.prefixes){
    const digits=Array(cat.commands.length).fill(0),trial={prefix:prefix.slice(),rejectedAssignments:0};
    base.trials.push(trial);
    const proofs=[];
    try{
      do{
        if(work.assignments>=assignments)return {...base,status:'search-inconclusive',reason:'assignment-budget'};
        work.assignments++;
        const choices=digits.map(pairAt);
        const {rows,width,shared}=inequalities(cat,prefix,choices,spend);
        const result=intersectFeedbackHalfspaces(rows,width,spend);
        if(result.point){
          trial.collision=physicalCollision(source,prefix,choices,cat,result.point,shared);break;
        }
        need(checkFeedbackContradiction(rows,width,result.proof),'derived inequality certificate failed exact verification');
        proofs.push(result.proof.map(([i,w])=>[i,String(w)]));trial.rejectedAssignments++;
      }while(advance(digits,pairCount));
    }catch(error){
      if(error!==exhausted)throw error;
      return {...base,status:'search-inconclusive',reason:'linear-work-budget'};
    }
    if(!trial.collision)return {...base,status:'one-feedback-certified',prefix:prefix.slice(),proofs};
  }
  return {...base,status:'all-declared-prefixes-refuted'};
}

/** Check a complete winning certificate by exact substitution without solving an LP. */
export function verifyOneFeedbackCertificate(request,saved){
  const cat=parse(request),prefix=saved?.prefix;
  need(saved?.schema===ONE_FEEDBACK_PLAN&&saved.status==='one-feedback-certified'&&
    equalPositionDriftData(saved.source,canonicalCatalog(request,cat))&&equalPositionDriftData(saved.limits,request.limits)&&
    request.prefixes.some(p=>equalPositionDriftData(p,prefix)),
    'certificate needs a declared winning prefix');
  const digits=Array(cat.commands.length).fill(0),count=cat.ids.length*(cat.ids.length-1)/2;
  const proofs=saved.proofs;
  need(Array.isArray(proofs)&&proofs.length<=request.limits.assignments,'proof list exceeds the declared assignment budget');
  let ordinal=0,work=0;
  const spend=()=>need(++work<=request.limits.linearWork,'certificate exceeds declared linear-work budget');
  do{
    const encoded=proofs[ordinal++];
    need(Array.isArray(encoded)&&encoded.every(term=>Array.isArray(term)&&term.length===2&&typeof term[1]==='string'&&/^[1-9][0-9]*$/.test(term[1])),'missing assignment or malformed weight');
    const {rows,width}=inequalities(cat,prefix,digits.map(pairAt),spend);
    need(checkFeedbackContradiction(rows,width,encoded.map(([i,w])=>[i,BigInt(w)])),'weighted physical inequalities do not contradict');
  }while(advance(digits,count));
  need(ordinal===proofs.length,'unexpected extra assignment proofs');
  return true;
}

export function openOneFeedback(request,saved){
  const plan=planOneFeedback(request);
  need(equalPositionDriftData(plan,saved),'saved source, policy, refutations or work counters differ');
  need(plan.status==='one-feedback-certified','the search produced no executable policy');
  return {receive:values=>receiveOneFeedback(plan,values)};
}

// Notebook entry points call this only on their already rederived frozen plan.
export function receiveOneFeedback(plan,values){
  const {source,prefix}=plan,physical=openPositionDriftFeedback(source),cut=prefix.length+1;
  need(plan.status==='one-feedback-certified'&&Array.isArray(values)&&values.length>=1&&values.length<=cut+1,'give a valid prefix of a certified course');
  if(values.length<cut){
    const word=prefix.slice(0,values.length-1),witnesses=physical.receive(word,values);
    return {commands:word,witnesses,nextCommand:witnesses.length?prefix[word.length]:null};
  }
  const old=values.slice(0,cut),witnesses=physical.receive(prefix,old);
  const command=witnesses.length?selectSafePositionDriftCommand(physical.finalOptions(prefix,old)):null;
  need(!witnesses.length||command!==null,'certified prefix has no safe last command');
  if(values.length===cut)return {commands:prefix.slice(),witnesses,nextCommand:command};
  need(command!==null,'a last reading followed an inconsistent prefix');
  const word=[...prefix,command],final=physical.receive(word,values);
  need(final.length<=1,'terminal receiver retained an ambiguous pair');
  return {commands:word,witnesses:final,nextCommand:null};
}
