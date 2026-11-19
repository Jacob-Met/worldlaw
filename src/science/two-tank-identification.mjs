/**
 * Source-agnostic controlled level-state identification for a real two-tank lab.
 *
 * This is not a causal model of counterfactual pump interventions: measured
 * closed-loop future controls are conditioned upon only for held-out scoring.
 * No optimizer, model constructor, or split selector accepts test observations.
 *
 * All features are causal and dimensionless (% divided by 100); no logged
 * online RLS coefficients, PID gains, setpoints or future levels are consumed.
 */
export const TWO_TANK_SCHEMA='worldlaw.measured-two-tank/v1';
export const TWO_TANK_MODEL_TYPES=['ar2','arx','hydraulic','sindy'];
const must=(yes,why)=>{if(!yes)throw Error('two-tank: '+why);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clip=x=>Math.max(0,Math.min(1,x));
const sq=x=>Math.sqrt(Math.max(0,x));
const norm=p=>p/100;
const STLSQ_THRESHOLDS=[0,0.00005,0.0002,0.001,0.004];
const RIDGES=[1e-9,1e-6,1e-4];
export const TWO_TANK_CANDIDATES=TWO_TANK_MODEL_TYPES.flatMap(type=>
  (type==='sindy'?STLSQ_THRESHOLDS:[0]).flatMap(threshold=>
    RIDGES.map(ridge=>({type,ridge,threshold}))));

export function validateTwoTankRun(raw){
  must(raw&&typeof raw==='object'&&typeof raw.id==='string'&&raw.id.length>0,'run ID required');
  must(['Baseline','PassiveOutflow','Disturbance'].includes(raw.group),'unknown source group');
  must(Array.isArray(raw.samples)&&raw.samples.length>=6&&raw.samples.length<=40000,'6..40000 original samples per run');
  let previous=-Infinity;
  const samples=raw.samples.map(s=>{
    must(finite(s.time)&&s.time>previous,'timestamps must strictly increase within a run');
    previous=s.time;
    const valid=s.valid!==false&&[s.level,s.pump,s.valve].every(x=>finite(x)&&x>=0&&x<=100);
    return {time:s.time,level:valid?norm(s.level):null,pump:valid?norm(s.pump):null,
      valve:valid?norm(s.valve):null,valid,perturbation:s.perturbation===true};
  });
  return {id:raw.id,group:raw.group,sha256:raw.sha256??null,samples};
}
export function partitionTwoTankRuns(runs){
  must(Array.isArray(runs)&&runs.length>=3,'three source groups are needed');
  const ids=new Set(),groups={Baseline:[],PassiveOutflow:[],Disturbance:[]};
  for(const raw of runs){
    const run=validateTwoTankRun(raw);
    must(!ids.has(run.id),'duplicate source recording ID: '+run.id);
    ids.add(run.id);groups[run.group].push(run);
  }
  for(const group of Object.keys(groups)){
    groups[group].sort((a,b)=>a.id.localeCompare(b.id));
    must(groups[group].length>0,'missing entire '+group+' group');
  }
  // The heldout files are *always* external Disturbance recordings.
  const train=[...groups.Baseline],development=[],test=[...groups.Disturbance];
  groups.PassiveOutflow.forEach((run,index)=>(index%4===3?development:train).push(run));
  must(development.length>0&&train.length>0&&test.length>0,'cannot form source-disjoint train/dev/test');
  return {train,development,test,assignment:{
    train:train.map(x=>x.id),development:development.map(x=>x.id),test:test.map(x=>x.id),
    policy:'complete original files, PassiveOutflow sorted every fourth to development; all Disturbance sealed',
  }};
}
function consecutive(samples,start,end){
  if(start<0||end>=samples.length)return false;
  for(let k=start;k<=end;k++){
    if(!samples[k].valid)return false;
    if(k>start&&Math.abs((samples[k].time-samples[k-1].time)-1)>0.01)return false;
  }
  return true;
}
function rowBasis(type,a,b,c,d){
  // a=y[t], b=y[t-1], c=control[t-1], d=control[t-2].
  const y=a.level,old=b.level,u=c.pump,u2=d.pump,v=c.valve,v2=d.valve,root=sq(y);
  switch(type){
    case 'ar2':return [1,y,old,u];
    case 'arx':return [1,y,old,u,u2,v,v2,u*v,u*y,v*y];
    case 'hydraulic':return [1,u,-root,-v*root];
    case 'sindy':return [1,y,root,y*y,u,u2,v,v*root,u*v,u*y,v*y];
    default:throw Error('two-tank: unsupported structural model');
  }
}
function targetOf(type,run,t,shift){
  if(shift){
    const index=(t+1+37)%run.samples.length;
    return run.samples[index].valid?run.samples[index].level:null;
  }
  const next=run.samples[t+1].level;
  return type==='hydraulic'||type==='sindy'?next-run.samples[t].level:next;
}
function matrix(n){
  return Array.from({length:n},()=>Array(n).fill(0));
}
function normalEquations(type,runs,permutedTargets=false){
  const dim=type==='ar2'?4:type==='hydraulic'?4:type==='arx'?10:11;
  const gram=matrix(dim),cross=Array(dim).fill(0),second=Array(dim).fill(0);
  let count=0,discarded=0;
  for(const run of runs){
    const s=run.samples;
    for(let t=2;t<s.length-1;t++){
      if(!consecutive(s,t-2,t+1)){discarded++;continue;}
      const features=rowBasis(type,s[t],s[t-1],s[t-1],s[t-2]);
      const target=targetOf(type,run,t,permutedTargets);
      if(!finite(target)){discarded++;continue;}
      for(let i=0;i<dim;i++){
        cross[i]+=features[i]*target;second[i]+=features[i]*features[i];
        for(let j=0;j<=i;j++)gram[i][j]+=features[i]*features[j];
      }
      count++;
    }
  }
  must(count>=dim*6,'too few independent valid training transitions for '+type);
  for(let i=0;i<dim;i++)for(let j=i+1;j<dim;j++)gram[i][j]=gram[j][i];
  return {type,gram,cross,second,count,discarded};
}
function solveStable(gram,cross,ridge,active,constrained=false){
  const n=cross.length,x=Array(n).fill(0),indices=active.map((v,i)=>v?i:-1).filter(v=>v>=0);
  // Cholesky of ridge-regularized training normal equations; finite pivots
  // and an explicit refusal avoid pretending singular data identify physics.
  const g=indices.map(i=>indices.map(j=>gram[i][j]+(i===j&&i>0?ridge:0))),
    y=indices.map(i=>cross[i]),L=matrix(indices.length);
  for(let i=0;i<indices.length;i++)for(let j=0;j<=i;j++){
    let v=g[i][j];for(let k=0;k<j;k++)v-=L[i][k]*L[j][k];
    if(i===j){if(!(v>1e-14))return null;L[i][j]=Math.sqrt(v);}
    else L[i][j]=v/L[j][j];
  }
  const z=y.slice();
  for(let i=0;i<indices.length;i++){
    for(let j=0;j<i;j++)z[i]-=L[i][j]*z[j];
    z[i]/=L[i][i];
  }
  const sol=z.slice();
  for(let i=sol.length-1;i>=0;i--){
    for(let j=i+1;j<sol.length;j++)sol[i]-=L[j][i]*sol[j];
    sol[i]/=L[i][i];
  }
  indices.forEach((i,j)=>x[i]=sol[j]);
  if(constrained){
    // Signed basis already encodes nonnegative hydraulic pump/inflow and
    // sqrt-level discharge. Coordinate NNLS enforces these physical signs.
    // The intercept is unconstrained. This is NOT a guarantee of a real law.
    x[0]=sol[indices.indexOf(0)];
    for(let i=1;i<n;i++)x[i]=Math.max(0,x[i]);
    for(let it=0;it<5000;it++){
      let maxDelta=0;
      for(const i of indices){
        let total=cross[i];for(const j of indices)if(j!==i)total-=gram[i][j]*x[j];
        const next=(i===0?total/(gram[i][i]):Math.max(0,total/(gram[i][i]+ridge)));
        maxDelta=Math.max(maxDelta,Math.abs(next-x[i]));x[i]=next;
      }
      if(maxDelta<1e-12)break;
      if(it===4999)return null;
    }
  }
  return x.every(finite)?x:null;
}
export function fitTwoTankCandidate(runs,spec,{targetShuffle=false}={}){
  must(Array.isArray(runs)&&runs.every(r=>r.group!=='Disturbance'),'test records are forbidden in model fitting');
  must(TWO_TANK_CANDIDATES.some(c=>JSON.stringify(c)===JSON.stringify(spec)),'unregistered candidate or settings');
  const stats=normalEquations(spec.type,runs,targetShuffle),active=stats.cross.map(()=>true),lambda=spec.ridge*stats.count;
  let coefficients=solveStable(stats.gram,stats.cross,lambda,active,spec.type==='hydraulic');
  must(coefficients!==null,'unidentifiable or numerically singular '+spec.type+' training Gram');
  if(spec.type==='sindy'&&spec.threshold>0){
    for(let iteration=0;iteration<8;iteration++){
      let changed=false;
      for(let i=1;i<coefficients.length;i++){
        // Feature effect measured in native dimensionless level units.
        const effect=Math.abs(coefficients[i])*Math.sqrt(stats.second[i]/stats.count);
        if(active[i]&&effect<spec.threshold){active[i]=false;changed=true;}
      }
      if(!changed)break;
      coefficients=solveStable(stats.gram,stats.cross,lambda,active);
      must(coefficients!==null,'sparse basis rank cannot support the proposed active set');
    }
  }
  return {schema:TWO_TANK_SCHEMA,type:spec.type,coefficients,spec:{...spec},
    active:active.map((v,i)=>v?i:null).filter(x=>x!==null),
    trainCount:stats.count,discardedTrain:stats.discarded,
    trainingOnly:true,conditioning:'future controls are OBSERVED; not causal intervention evidence'};
}
export function predictTwoTank(model,run,t,{shiftControls=0,zeroValve=false,levels=null}={}){
  const s=run.samples,find=i=>s[(i+shiftControls+s.length*2)%s.length],
    a=levels?.current??s[t].level,b=levels?.previous??s[t-1].level;
  const v={...s[t],level:a},old={...s[t-1],level:b},
    input=shiftControls?find(t-1):s[t-1],input2=shiftControls?find(t-2):s[t-2],
    c=zeroValve?{...input,valve:0}:input,d=zeroValve?{...input2,valve:0}:input2;
  const feature=rowBasis(model.type,v,old,c,d);
  let output=model.coefficients.reduce((sum,coef,i)=>sum+coef*feature[i],0);
  if(model.type==='hydraulic'||model.type==='sindy')output+=a;
  return finite(output)?clip(output):null;
}
export function evaluateTwoTankModel(model,runs,{shiftControls=0,zeroValve=false,horizons=[30,120],stride=180}={}){
  must(Array.isArray(runs)&&runs.length>0,'evaluate requires source runs');
  must(horizons.every(h=>Number.isInteger(h)&&h>=1&&h<=120)&&Number.isInteger(stride)&&stride>0,'bounded horizons and stride');
  const byRun=[],totals={};
  for(const horizon of [1,...horizons])totals[horizon]={squared:0,count:0};
  for(const run of runs){
    let squared=0,count=0,nonfinite=0;const s=run.samples,rollouts={};
    for(const h of horizons)rollouts[h]={squared:0,count:0};
    for(let t=2;t<s.length-1;t++){
      if(!consecutive(s,t-2,t+1))continue;
      const y=predictTwoTank(model,run,t,{shiftControls,zeroValve});
      if(y===null){nonfinite++;continue;}
      squared+=(y-s[t+1].level)**2;count++;
    }
    for(const h of horizons){
      for(let start=2;start+h<s.length;start+=stride){
        if(!consecutive(s,start-2,start+h))continue;
        let previous=s[start-1].level,current=s[start].level,ok=true;
        for(let step=0;step<h;step++){
          const next=predictTwoTank(model,run,start+step,{shiftControls,zeroValve,levels:{current,previous}});
          if(next===null){ok=false;break;}
          previous=current;current=next;
        }
        if(ok){rollouts[h].squared+=(current-s[start+h].level)**2;rollouts[h].count++;}
        else nonfinite++;
      }
    }
    const per={id:run.id,group:run.group,oneStep:{rmse:count?100*Math.sqrt(squared/count):null,count},horizons:{},nonfinite};
    for(const h of horizons){
      per.horizons[h]={rmse:rollouts[h].count?100*Math.sqrt(rollouts[h].squared/rollouts[h].count):null,count:rollouts[h].count};
      totals[h].squared+=rollouts[h].squared;totals[h].count+=rollouts[h].count;
    }
    totals[1].squared+=squared;totals[1].count+=count;
    byRun.push(per);
  }
  const macro={};
  for(const h of [1,...horizons]){
    const values=byRun.map(r=>h===1?r.oneStep.rmse:r.horizons[h].rmse).filter(finite);
    macro[h]=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  }
  return {byRun,macro,micro:Object.fromEntries(Object.entries(totals).map(([h,v])=>[h,{rmse:v.count?100*Math.sqrt(v.squared/v.count):null,count:v.count}])),
    interpretation:'percent-level RMSE; closed-loop log controls treated as supplied future forcing in rollouts, NOT counterfactual control validity'};
}
export function trainSelectTwoTank(train,development){
  must(train.length>0&&development.length>0,'nonempty independent train/dev');
  must([...train,...development].every(r=>r.group!=='Disturbance'),'test group must be sealed outside selection');
  const results=[];
  for(const spec of TWO_TANK_CANDIDATES){
    try{
      const model=fitTwoTankCandidate(train,spec),dev=evaluateTwoTankModel(model,development);
      results.push({model,dev,score:dev.macro[120]===null?Infinity:dev.macro[120]});
    }catch(error){results.push({spec,error:String(error),score:Infinity});}
  }
  const selected={},devTable=[];
  for(const type of TWO_TANK_MODEL_TYPES){
    const choices=results.filter(r=>(r.model?.type??r.spec?.type)===type);
    choices.sort((a,b)=>a.score-b.score);
    must(choices[0]?.model&&Number.isFinite(choices[0].score),'no valid development model for '+type);
    selected[type]=choices[0].model;
    devTable.push({type,selectedSpec:choices[0].model.spec,devMacro:choices[0].dev.macro,attempts:choices.map(x=>({spec:x.model?.spec??x.spec,score:x.score,error:x.error??null}))});
  }
  return {schema:TWO_TANK_SCHEMA,selected,development:devTable,selectionTarget:'30/120-second open-loop dev only, primary 120 s per-run macro RMSE'};
}
