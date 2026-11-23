import {fitLinearColumns} from './linear-fit.mjs';

const terminals = {
  oscillator: ['position','rate','command'],
  torque: ['position','rate','command'],
  periodic: ['field','command','dx','dxx']
};
const unary = new Map([['sin',Math.sin],['cos',Math.cos],['abs',Math.abs],['tanh',Math.tanh]]);
const binary = new Map([['add',(a,b)=>a+b],['mul',(a,b)=>a*b],['div',(a,b)=>b===0?NaN:a/b]]);
export class EvolutionDomainError extends RangeError {
  constructor(reason) { super(reason); this.code=reason; }
}
function insist(ok, reason) { if (!ok) throw new RangeError(reason); }
function limit(n, min, max, name) {
  insist(Number.isInteger(n)&&n>=min&&n<=max,'Invalid '+name);
  return n;
}
function coordinates(kind, row) {
  insist(Object.hasOwn(terminals,kind) && row && typeof row==='object','Invalid evolution geometry');
  const keys=kind!=='periodic'?terminals[kind]:['field','command','left','right','spacing'];
  insist(keys.every(k=>Number.isFinite(row[k])),'Missing or nonfinite evolution coordinate');
  if (kind!=='periodic') return row;
  insist(row.spacing>0,'Grid spacing must be positive');
  const dx=(row.right-row.left)/(2*row.spacing);
  const dxx=(row.left-2*row.field+row.right)/(row.spacing**2);
  insist(Number.isFinite(dx)&&Number.isFinite(dxx),'Nonfinite spatial derivative');
  return {field:row.field,command:row.command,dx,dxx};
}
function apply(op,a,b) {
  if (!Number.isFinite(a) || (binary.has(op) && !Number.isFinite(b))) return NaN;
  const value=unary.has(op)?unary.get(op)(a):binary.get(op)(a,b);
  return Number.isFinite(value)?value:NaN;
}
function treeValue(tree,row,kind,size) {
  insist(++size.count<=32,'Operator tree is too large');
  if (typeof tree==='string') {
    insist(tree==='one'||terminals[kind].includes(tree),'Invalid evolution terminal');
    return tree==='one'?1:row[tree];
  }
  insist(Array.isArray(tree)&&(unary.has(tree[0])?tree.length===2:binary.has(tree[0])&&tree.length===3),'Invalid operator node');
  return apply(tree[0],treeValue(tree[1],row,kind,size),tree.length===3?treeValue(tree[2],row,kind,size):undefined);
}
export function predictEvolution(model,input) {
  insist(model?.schema==='worldlaw.symbolic-evolution/v1'&&Object.hasOwn(terminals,model.kind)&&
    Array.isArray(model.terms)&&model.terms.length<=4,'Invalid symbolic evolution model');
  const row=coordinates(model.kind,input);
  let y=0;
  for (const {tree,weight} of model.terms) {
    insist(Number.isFinite(weight),'Invalid evolution coefficient');
    y+=weight*treeValue(tree,row,model.kind,{count:0});
  }
  if (!Number.isFinite(y)) throw new EvolutionDomainError('undefined_operator');
  return y;
}
export function assessEvolution(model, rows, tolerance) {
  insist(Array.isArray(rows)&&rows.length>0&&rows.length<=4096&&Number.isFinite(tolerance)&&tolerance>=0,'Invalid assessment');
  let squared=0,maxError=-1,worstRow=-1;
  for (const [i,row] of rows.entries()) {
    insist(Number.isFinite(row.change),'Invalid measured derivative');
    let y;
    try { y=predictEvolution(model,row); }
    catch (err) {
      if (!(err instanceof EvolutionDomainError)) throw err;
      return {accepted:false,reason:'undefined_operator',maxError:null,rmse:null,worstRow:i};
    }
    const e=Math.abs(y-row.change);squared+=e*e;
    if(e>maxError){maxError=e;worstRow=i;}
  }
  insist(Number.isFinite(squared),'Nonfinite assessment residuals');
  return {accepted:maxError<=tolerance,reason:maxError<=tolerance?'within_tolerance':'residual_mismatch',
    maxError,rmse:Math.sqrt(squared/rows.length),worstRow};
}

// Each node points to already-computed columns. The structural budget is explicit;
// exceeding it refuses the declared grammar instead of silently truncating one side.
function columns(kind,xs,operators,maxNodes,maxCandidates) {
  const bank=[],sizes=[[]];
  function record(tree,values,level) {
    insist(bank.length<maxCandidates,'Declared grammar exceeds its candidate budget');
    const i=bank.length;
    const count=t=>typeof t==='string'?1:1+t.slice(1).reduce((a,x)=>a+count(x),0);
    bank.push({tree,values,cost:count(tree),norm:values.every(Number.isFinite)?Math.hypot(...values):NaN});
    level.push(i);
  }
  const atoms=[];
  for (const id of ['one',...terminals[kind]]) record(id,xs.map(x=>id==='one'?1:x[id]),atoms);
  sizes.push(atoms);
  for(let n=2;n<=maxNodes;n++) {
    const level=[];
    for(const op of operators) {
      if(unary.has(op)) {
        for(const i of sizes[n-1]) {
          const a=bank[i];
          if(a.tree!=='one') record([op,a.tree],a.values.map(v=>apply(op,v)),level);
        }
        continue;
      }
      for(let l=1;l<n-1;l++) for(const i of sizes[l]) for(const j of sizes[n-1-l]) {
        const a=bank[i],b=bank[j];
        if(op!=='div'&&i>j) continue;
        if(op==='mul'&&(a.tree==='one'||b.tree==='one')) continue;
        if(op==='div'&&(b.tree==='one'||i===j)) continue;
        record([op,a.tree,b.tree],a.values.map((v,k)=>apply(op,v,b.values[k])),level);
      }
    }
    sizes.push(level);
  }
  return bank;
}

export function synthesizeEvolution(rows, options={}) {
  const {kind,operators,maxNodes=4,maxCandidates=3000,maxTerms=2,beam=6,tolerance}=options;
  insist(Object.hasOwn(terminals,kind),'Invalid evolution geometry');
  insist(Array.isArray(operators)&&operators.length>0&&new Set(operators).size===operators.length&&
    operators.every(op=>unary.has(op)||binary.has(op)),'Invalid operator menu');
  limit(maxNodes,1,7,'node budget');limit(maxCandidates,5,12000,'candidate budget');
  limit(maxTerms,1,4,'support budget');limit(beam,1,32,'beam width');
  insist(Array.isArray(rows)&&rows.length>=4&&rows.length<=1024&&Number.isFinite(tolerance)&&tolerance>=0,'Invalid training design');
  insist(maxCandidates*rows.length<=2000000,'Declared grammar exceeds its column storage budget');
  const xs=rows.map(r=>coordinates(kind,r)), target=rows.map(r=>r.change);
  insist(target.every(Number.isFinite),'Invalid measured training response');
  const bank=columns(kind,xs,operators,maxNodes,maxCandidates);
  let work=bank.length*target.length;
  function charge(n) {
    work+=n;
    insist(work<=50000000,'Operator fit exceeds its numerical work budget');
  }
  const toModel=f=>({schema:'worldlaw.symbolic-evolution/v1',kind,terms:f.ids.map((id,k)=>({tree:bank[id].tree,weight:f.weights[k]}))});
  function fit(ids) {
    charge(target.length*(1+3*ids.length*ids.length));
    const cs=ids.map(i=>bank[i].values), qr=fitLinearColumns(cs,target);
    if(!qr)return null;
    const residual=target.map((v,t)=>v-cs.reduce((s,c,k)=>s+c[t]*qr.coefficients[k],0));
    const rmse=Math.hypot(...residual)/Math.sqrt(target.length);
    return Number.isFinite(rmse)?{ids,residual,weights:qr.coefficients,rmse,maxError:Math.max(...residual.map(Math.abs))}:null;
  }
  let front=[fit([])];
  insist(front[0],'Invalid target scale');
  const retained=[...front];
  for(let size=1;size<=maxTerms;size++) {
    const next=new Map();
    for(const base of front) {
      charge(bank.length*target.length);
      const scores=[];
      for(let i=0;i<bank.length;i++) {
        const x=bank[i];
        if(!Number.isFinite(x.norm)||x.norm===0||base.ids.includes(i))continue;
        const score=Math.abs(x.values.reduce((s,v,j)=>s+v*base.residual[j],0))/x.norm;
        if(Number.isFinite(score)) scores.push({i,score});
      }
      scores.sort((a,b)=>b.score-a.score || a.i-b.i);
      let accepted=0;
      for(const {i} of scores) {
        const ids=[...base.ids,i].sort((a,b)=>a-b), key=ids.join(',');
        const result=next.get(key)??fit(ids);
        if(!result)continue;
        next.set(key,result);
        if(++accepted===beam)break;
      }
    }
    front=[...next.values()].sort((a,b)=>a.rmse-b.rmse).slice(0,beam);
    retained.push(...front);
    if(!front.length)break;
  }
  const feasible=retained.filter(f=>f.maxError<=tolerance);
  const ranked=feasible.length?feasible:retained;
  const cost=f=>f.ids.reduce((s,i)=>s+bank[i].cost,0);
  ranked.sort((a,b)=>(feasible.length?(a.ids.length-b.ids.length||cost(a)-cost(b)):0)||a.rmse-b.rmse);
  const best=ranked[0];
  return {status:feasible.length?'candidate':'abstained',reason:feasible.length?'within_training_tolerance':'residual_mismatch',
    model:toModel(best),training:{rmse:best.rmse,maxError:best.maxError},generated:bank.length,
    undefinedOnTraining:bank.filter(x=>!Number.isFinite(x.norm)).length,frontier:ranked.slice(0,beam).map(toModel)};
}
