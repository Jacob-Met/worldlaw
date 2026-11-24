import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {discoverTrajectoryEvolution,designTrajectoryExcitation} from '../src/science/trajectory-operator-synthesis.mjs';
import {forecastStateTrajectory} from '../src/science/state-trajectory.mjs';

const root=resolve(process.env.NULLGARDEN_SOURCE||'.independent-state-nullgarden');
const producer=await import(pathToFileURL(join(root,'src/state-operator-course.mjs')).href);
const {stateOperatorWorlds,stateOperatorPlan,observeStateOperatorWorld,outsideStateOperatorWorlds,STATE_OPERATOR_PROTOCOL}=producer;
const output=resolve(process.env.STATE_OPERATOR_OUTPUT||'.receipts/state-operators');
const shard=Number(process.env.STATE_OPERATOR_SHARD||0),shards=Number(process.env.STATE_OPERATOR_SHARDS||1);
if(!Number.isInteger(shard)||!Number.isInteger(shards)||shards<1||shards>6||shard<0||shard>=shards)throw Error('Invalid course shard');
mkdirSync(join(output,'cases'),{recursive:true});
const methods=[{id:'weak_beam',method:'weak',estimator:'beam'},{id:'weak_stlsq',method:'weak',estimator:'stlsq'},{id:'derivative_stlsq',method:'derivative',estimator:'stlsq'}];
const rows=[],failures=[];
const sha=directory=>execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim();
const provenance={worldlaw:sha(process.cwd()),nullgarden:sha(root),node:process.version,shard,shards};
if(provenance.nullgarden!=='4af7717a866e0246e7c0bcd81977cea53cddbd8c')throw Error('Nullgarden source does not match the frozen producer');
const save=(path,value)=>writeFileSync(path,JSON.stringify(value)+'\n');

function fit(method,training,selection) {
  const common={method:method.method,estimator:method.estimator,windowPoints:61,stride:15,spatialRadius:4,spatialStride:4,smoothingPoints:11,maxTerms:4,beam:6,
    thresholds:[.025,.05,.1,.2],ridges:[1e-6,1e-3,.1],adequacyNoiseMultiplier:3,adequacySignalFraction:.03};
  const expanded=discoverTrajectoryEvolution(training,selection,common);
  if(method.estimator==='beam')return expanded;
  // Standard polynomial SINDy is a second nested-library candidate. Selection,
  // never test error, chooses between this and the same expanded DAG library.
  const polynomial=discoverTrajectoryEvolution(training,selection,{...common,grammar:{degree:3,unary:[],rational:false,flux:true}});
  const choices=[expanded,polynomial].sort((a,b)=>(a.selection.score??Infinity)-(b.selection.score??Infinity));
  const best=choices[0],candidates=choices.flatMap(x=>x.candidates).filter(x=>!x.diverged).sort((a,b)=>a.score-b.score);
  return {...best,frontier:candidates.slice(0,8).map(x=>x.model),baselineLibraries:'expanded and polynomial; chosen on the selection recording'};
}
function score(model,held) {
  const forecast=forecastStateTrajectory(model,held.observation);
  if(!forecast.states)return {loss:10,rawRelativeError:null,diverged:true,startIndex:forecast.startIndex,predictions:null};
  let error=0,signal=0,count=0;
  for(let t=1;t<forecast.states.length;t++)for(let d=0;d<forecast.states[t].length;d++){
    const y=held.reference.states[t+forecast.startIndex][d];
    error+=(forecast.states[t][d]-y)**2;signal+=y*y;count++;
  }
  const raw=Math.sqrt(error/Math.max(signal,count*STATE_OPERATOR_PROTOCOL.relativeErrorFloor**2));
  return {loss:Math.min(10,raw),rawRelativeError:raw,diverged:false,startIndex:forecast.startIndex,predictions:forecast.states};
}
function shuffled(record,seed) {
  const result=structuredClone(record),n=result.observation.samples.length,order=Array.from({length:n},(_,i)=>i);
  let state=seed>>>0;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  result.observation.id+=':permuted';
  result.observation.samples.forEach((r,i)=>{r.state=[...record.observation.samples[order[i]].state];});
  result.reference.states=order.map(i=>[...record.reference.states[i]]);
  result.reference.permutation=order;return result;
}
function summarize() {
  const grouped={};
  for(const r of rows){const key=[r.control,r.method,r.acquisition,r.snrDb].join('/');(grouped[key]??=[]).push(r);}
  return {provenance,protocol:STATE_OPERATOR_PROTOCOL,totalRows:rows.length,failures,
    groups:Object.fromEntries(Object.entries(grouped).map(([key,rs])=>[key,{count:rs.length,meanLoss:rs.reduce((s,r)=>s+r.loss,0)/rs.length,worstLoss:Math.max(...rs.map(r=>r.loss)),predictiveCandidates:rs.filter(r=>r.status==='predictive_candidate').length,diverged:rs.filter(r=>r.diverged).length,fitFailures:rs.filter(r=>r.fitFailure).length}])),
    rows:rows.map(({predictions,...r})=>r)};
}
function record(world,snrDb,control,method,acquisition,query,modelResult,held,extra={}) {
  let metrics;
  try{metrics=score(modelResult.model,held);}catch(error){metrics={loss:10,rawRelativeError:null,diverged:true,predictions:null,scoringError:error.message};}
  const row={world:world.id,kind:world.kind,snrDb,control,method:method.id,acquisition,query,status:modelResult.status,structuralIdentification:modelResult.structuralIdentification,selection:modelResult.selection,model:modelResult.model,chargedRecordings:4,chargedStateValues:4*held.observation.samples.length*held.observation.samples[0].state.length,...metrics,...extra};
  rows.push(row);save(join(output,'cases',world.id+'-'+snrDb+'-'+control+'-'+method.id+'-'+acquisition+'.json'),row);
  const {predictions,selection,model,...pulse}=row;console.log(JSON.stringify(pulse));
  save(join(output,'summary.json'),summarize());
}
function failed(world,snrDb,control,method,acquisition,query,error) {
  const row={world:world.id,kind:world.kind,snrDb,control,method:method.id,acquisition,query,status:'abstained',structuralIdentification:false,loss:10,rawRelativeError:null,diverged:true,fitFailure:true,error:String(error.message||error),chargedRecordings:4};
  rows.push(row);failures.push(row);console.log(JSON.stringify(row));save(join(output,'summary.json'),summarize());
}

const roster=stateOperatorWorlds('evaluation',927341);
if(roster.length!==20||new Set(roster.map(w=>w.id)).size!==20)throw Error('Incomplete twenty-law roster');
for(const [wi,world] of roster.entries()) {
  if(wi%shards!==shard)continue;
  for(const [si,snrDb] of STATE_OPERATOR_PROTOCOL.snrDb.entries()) {
    const seed=57193+1000*wi+100*si,records={};
    for(const [ri,role] of ['train0','train1','selection','test'].entries())records[role]=observeStateOperatorWorld(world,stateOperatorPlan(world.kind,role),snrDb,seed+ri);
    const menu=[0,1,2].map(q=>stateOperatorPlan(world.kind,'query',q));
    const acquire=q=>(records['query'+q]??=observeStateOperatorWorld(world,menu[q],snrDb,seed+50+q));
    const randomQuery=(wi*131+si*17+11)%3,training=[records.train0.observation,records.train1.observation],selection=[records.selection.observation];
    for(const method of methods) {
      let initial,design;
      try{initial=fit(method,training,selection);design=designTrajectoryExcitation(initial,menu);}
      catch(error){design={status:'planning_refused',selected:null,error:error.message};}
      const active=menu.findIndex(p=>p.id===design.selected),activeQuery=active<0?0:active;
      for(const acquisition of ['active','random']) {
        const query=acquisition==='active'?activeQuery:randomQuery;
        try{
          const measured=acquire(query),start=performance.now();
          const result=fit(method,[...training,measured.observation],selection);
          record(world,snrDb,'law',method,acquisition,query,result,records.test,{fitSeconds:(performance.now()-start)/1000,planning:acquisition==='active'?design:null,planningFallback:acquisition==='active'&&active<0});
        }catch(error){failed(world,snrDb,'law',method,acquisition,query,error);}
      }
      const controls=[records.train0,records.train1,acquire(randomQuery),records.selection,records.test].map((r,j)=>shuffled(r,seed+901+j));
      try{record(world,snrDb,'time_permutation',method,'random',randomQuery,fit(method,controls.slice(0,3).map(x=>x.observation),[controls[3].observation]),controls[4]);}
      catch(error){failed(world,snrDb,'time_permutation',method,'random',randomQuery,error);}
    }
    save(join(output,'cases',world.id+'-'+snrDb+'-observations.json'),records);
  }
}
for(const [wi,world] of outsideStateOperatorWorlds().entries()) {
  if(wi%shards!==shard)continue;
  for(const [si,snrDb] of STATE_OPERATOR_PROTOCOL.snrDb.entries()) {
    const seed=89137+1000*wi+100*si,query=(wi+si)%3;
    const records=['train0','train1','query','selection','test'].map((role,j)=>observeStateOperatorWorld(world,stateOperatorPlan(world.kind,role,query),snrDb,seed+j));
    for(const method of methods)try{
      record(world,snrDb,'omitted_mechanism',method,'random',query,fit(method,records.slice(0,3).map(x=>x.observation),[records[3].observation]),records[4]);
    }catch(error){failed(world,snrDb,'omitted_mechanism',method,'random',query,error);}
    save(join(output,'cases',world.id+'-'+snrDb+'-observations.json'),records);
  }
}
const expected=roster.filter((_,i)=>i%shards===shard).length*27+outsideStateOperatorWorlds().filter((_,i)=>i%shards===shard).length*9;
if(rows.length!==expected)throw Error('Missing attempted-run denominator: '+rows.length+' / '+expected);
save(join(output,'summary.json'),summarize());
console.log(JSON.stringify({complete:true,provenance,expected,totalRows:rows.length,groups:summarize().groups}));
