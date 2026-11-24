import {fitLinearColumns} from './linear-fit.mjs';

const terminals = {
  oscillator: ['position','rate','command'],
  torque: ['position','rate','command'],
  periodic: ['field','command','dx','dxx']
};
const unary = new Map([['sin',Math.sin],['cos',Math.cos],['abs',Math.abs],['tanh',Math.tanh]]);
const spatial = new Set(['gradient','laplacian','thirdDerivative','biharmonic']);
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
  return {field:row.field,command:row.command,left:row.left,right:row.right,spacing:row.spacing,left2:row.left2,right2:row.right2,dx,dxx};
}
function apply(op,a,b) {
  if (!Number.isFinite(a) || (binary.has(op) && !Number.isFinite(b))) return NaN;
  const value=unary.has(op)?unary.get(op)(a):binary.get(op)(a,b);
  return Number.isFinite(value)?value:NaN;
}
// Apply the same pointwise expression at each observed cell of the requested stencil.
function pointValues(tree,field,size) {
  insist(++size.count<=32,'Operator tree is too large');
  if(tree==='field') return field;
  if(tree==='one') return field.map(()=>1);
  insist(Array.isArray(tree)&&(unary.has(tree[0])?tree.length===2:binary.has(tree[0])&&tree.length===3),
    'Spatial potential must use only the field, constants and pointwise operators');
  const a=pointValues(tree[1],field,size);
  const b=tree.length===3?pointValues(tree[2],field,size):null;
  return a.map((v,i)=>apply(tree[0],v,b?.[i]));
}
function spatialValue(op,tree,row,size) {
  const h=row.spacing;
  if(op==='thirdDerivative'||op==='biharmonic') {
    insist(Number.isFinite(row.left2)&&Number.isFinite(row.right2),'Second spatial neighbors required');
    const [ll,l,c,r,rr]=pointValues(tree,[row.left2,row.left,row.field,row.right,row.right2],size);
    return op==='thirdDerivative'?(rr-2*r+2*l-ll)/(2*h**3):(rr-4*r+6*c-4*l+ll)/h**4;
  }
  const [l,c,r]=pointValues(tree,[row.left,row.field,row.right],size);
  return op==='gradient'?(r-l)/(2*h):(l-2*c+r)/h**2;
}
function isPointPotential(tree) {
  if(typeof tree==='string')return tree==='field'||tree==='one';
  return !spatial.has(tree[0])&&tree.slice(1).every(isPointPotential);
}
function treeValue(tree,row,kind,size) {
  insist(++size.count<=32,'Operator tree is too large');
  if (typeof tree==='string') {
    insist(tree==='one'||terminals[kind].includes(tree),'Invalid evolution terminal');
    return tree==='one'?1:row[tree];
  }
  if(Array.isArray(tree)&&spatial.has(tree[0])) {
    insist(kind==='periodic'&&tree.length===2,'Spatial operators require one periodic-field potential');
    return spatialValue(tree[0],tree[1],row,size);
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
      if(spatial.has(op)) {
        for(const i of sizes[n-1]) {
          const tree=bank[i].tree;
          // The bare-field derivatives already have the one-node terminals dx and dxx.
          if((typeof tree!=='string'||(tree==='field'&&(op==='thirdDerivative'||op==='biharmonic')))&&isPointPotential(tree))
            record([op,tree],xs.map(row=>spatialValue(op,tree,row,{count:1})),level);
        }
        continue;
      }
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

function synthesisOptions(options) {
  const {kind,operators,maxNodes=4,maxCandidates=3000,maxTerms=2,beam=6,tolerance}=options;
  insist(Object.hasOwn(terminals,kind),'Invalid evolution geometry');
  insist(Array.isArray(operators)&&operators.length>0&&new Set(operators).size===operators.length&&
    operators.every(op=>unary.has(op)||binary.has(op)||(kind==='periodic'&&spatial.has(op))),'Invalid operator menu');
  limit(maxNodes,1,7,'node budget');limit(maxCandidates,5,12000,'candidate budget');
  limit(maxTerms,1,4,'support budget');limit(beam,1,32,'beam width');
  insist(Number.isFinite(tolerance)&&tolerance>=0,'Invalid training tolerance');
  return {kind,operators,maxNodes,maxCandidates,maxTerms,beam,tolerance};
}

export function synthesizeEvolution(rows, options={}) {
  const settings=synthesisOptions(options);
  const {kind,operators,maxNodes,maxCandidates}=settings;
  insist(Array.isArray(rows)&&rows.length>=4&&rows.length<=1024,'Invalid training design');
  insist(maxCandidates*rows.length<=2000000,'Declared grammar exceeds its column storage budget');
  const xs=rows.map(r=>coordinates(kind,r)),target=rows.map(r=>r.change);
  insist(target.every(Number.isFinite),'Invalid measured training response');
  return fitBank(columns(kind,xs,operators,maxNodes,maxCandidates),target,settings);
}

// At an observed edge, integrate test(t) du by parts. For the midpoint hat
// weights, the coefficient on an interior state is w[i-1] - w[i]. Thus the
// receiver consumes state levels and never forms a pointwise time derivative.
export function synthesizeWeakEvolution(runs, options={}) {
  const settings=synthesisOptions(options);
  const {kind,operators,maxNodes,maxCandidates}=settings;
  const {step,width=16,stride=8,spacing,component=kind==='periodic'?'field':'rate'}=options;
  insist(Number.isFinite(step)&&step>0,'Invalid observation cadence');
  limit(width,4,128,'weak window');limit(stride,1,128,'weak stride');
  insist(kind==='periodic'?component==='field':['position','rate'].includes(component),'Invalid observed component');
  insist(Array.isArray(runs)&&runs.length>0&&runs.length<=16,'Invalid weak training runs');
  const xs=[],windows=[];
  const w=Array.from({length:width},(_,i)=>1-Math.abs((2*i+1)/width-1));
  const area=w.reduce((s,v)=>s+v,0)*step;
  const stateWeight=Array.from({length:width+1},(_,i)=>((w[i-1]??0)-(w[i]??0))/area);
  const featureWeight=Array.from({length:width+1},(_,i)=>step*((w[i-1]??0)+(w[i]??0))/(2*area));
  for(const {values,commands} of runs) {
    insist(Array.isArray(values)&&values.length>width&&values.length<=2048&&
      Array.isArray(commands)&&commands.length===values.length,'Invalid measured trajectory');
    const n=Array.isArray(values[0])?values[0].length:0;
    insist(kind==='periodic'?n>=5&&n<=128&&Number.isFinite(spacing)&&spacing>0:n===2,'Invalid observation geometry');
    const channels=kind==='periodic'?n:1,start=xs.length;
    insist(start+values.length*channels<=16384&&maxCandidates*(start+values.length*channels)<=2000000,'Declared grammar exceeds its column storage budget');
    for(let t=0;t<values.length;t++) {
      const y=values[t],u=commands[t];
      insist(Array.isArray(y)&&y.length===n&&y.every(Number.isFinite),'Invalid measured state');
      if(kind==='periodic') {
        insist(Array.isArray(u)&&u.length===n&&u.every(Number.isFinite),'Invalid field command');
        for(let j=0;j<n;j++) xs.push(coordinates(kind,{field:y[j],command:u[j],spacing,
          left:y[(j+n-1)%n],right:y[(j+1)%n],left2:y[(j+n-2)%n],right2:y[(j+2)%n]}));
      } else {
        insist(Number.isFinite(u),'Invalid scalar command');
        xs.push(coordinates(kind,{position:y[0],rate:y[1],command:u}));
      }
    }
    for(let t=0;t+width<values.length;t+=stride) for(let j=0;j<channels;j++)
      windows.push({offset:start+t*channels+j,channels});
  }
  insist(windows.length>=4&&windows.length<=4096,'Invalid weak training design');
  insist(maxCandidates*windows.length*(width+1)<=50000000,'Weak projection exceeds its work budget');
  const project=(v,weights)=>windows.map(({offset,channels})=>weights.reduce((s,w,i)=>s+w*v[offset+i*channels],0));
  const target=project(xs.map(row=>row[component]),stateWeight);
  insist(target.every(Number.isFinite),'Nonfinite weak target');
  const bank=columns(kind,xs,operators,maxNodes,maxCandidates);
  for(const term of bank) {
    term.values=project(term.values,featureWeight);
    term.norm=term.values.every(Number.isFinite)?Math.hypot(...term.values):NaN;
  }
  const result=fitBank(bank,target,settings);
  return {...result,weak:{windows:windows.length,step,width,stride,component}};
}

function fitBank(bank,target,{kind,maxTerms,beam,tolerance}) {
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
