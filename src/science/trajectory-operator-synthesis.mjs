import {fitFreeWeakSTLSQ} from './free-weak-stlsq.mjs';
import {fitLinearColumns} from './linear-fit.mjs';
import {prepareStateTrajectory,validateStateTrajectory,forecastStateTrajectory,requireState,meanSquare} from './state-trajectory.mjs';
import {trajectoryOperatorGrammar,stateOperatorEquations} from './trajectory-operator-equations.mjs';
import {designEvolutionExcitation} from './operator-rollout.mjs';
export {trajectoryOperatorGrammar,stateOperatorEquations} from './trajectory-operator-equations.mjs';

const size=t=>typeof t==='string'||typeof t==='number'?1:1+t.slice(1).reduce((s,x)=>s+size(x),0);
const norm=v=>Math.sqrt(v.reduce((s,x)=>s+x*x,0));

export function designTrajectoryExcitation(discovery,courses) {
  requireState(discovery?.schema==='worldlaw.trajectory-operator-discovery/v1'&&Array.isArray(courses)&&courses.length>0,'Require fitted hypotheses and a declared experiment menu');
  const cost=courses.reduce((s,c)=>s+c.steps*c.initial.length,0);
  const count=Math.min(6,discovery.frontier.length,Math.floor(Math.sqrt(2000000/cost)));
  if(count<2)return {status:'abstained',reason:'insufficient_comparable_hypotheses',selected:null,consideredModels:count};
  const design=designEvolutionExcitation(discovery.frontier.slice(0,count),courses,{resolution:discovery.selection.noiseSigma||0});
  return {...design,consideredModels:count,scope:'finite simulated menu; observation noise is an estimated RMS resolution, not confidence'};
}

function sparseBeam(eq,maxTerms,beam) {
  const {columns,target}=eq,scales=columns.map(norm),seen=new Set(),retained=[];
  function fit(ids) {
    const c=ids.map(i=>columns[i]),q=fitLinearColumns(c,target);if(!q)return null;
    const residual=target.map((v,j)=>v-c.reduce((s,x,k)=>s+x[j]*q.coefficients[k],0));
    return {ids,weights:q.coefficients,residual,rmse:Math.sqrt(meanSquare(residual))};
  }
  let front=[fit([])];retained.push(...front);
  for(let count=1;count<=maxTerms;count++) {
    const next=[];
    for(const base of front) {
      const scored=columns.map((c,i)=>({i,score:scales[i]>0&&!base.ids.includes(i)?Math.abs(c.reduce((s,v,j)=>s+v*base.residual[j],0))/scales[i]:-1})).sort((a,b)=>b.score-a.score||a.i-b.i);
      let accepted=0;
      for(const {i,score} of scored) {
        if(score<0)break;const ids=[...base.ids,i].sort((a,b)=>a-b),id=ids.join(',');
        if(seen.has(id))continue;const f=fit(ids);if(!f)continue;
        seen.add(id);next.push(f);if(++accepted>=beam)break;
      }
    }
    front=next.sort((a,b)=>a.rmse-b.rmse).slice(0,beam);retained.push(...front);if(!front.length)break;
  }
  return retained;
}

function thresholdFits(eq,maxTerms,thresholds,ridges) {
  const {columns,target}=eq,scales=columns.map(c=>Math.sqrt(meanSquare(c))),ys=Math.sqrt(meanSquare(target))||1;
  const cols=columns.map((c,j)=>c.map(v=>v/(scales[j]||1))),y=target.map(v=>v/ys),out=[];
  function ridge(active,regularization) {
    const penalty=Math.sqrt(y.length*regularization);
    const cs=active.map((j,k)=>cols[j].concat(active.map((_,i)=>i===k?penalty:0)));
    return fitLinearColumns(cs,y.concat(active.map(()=>0)))?.coefficients;
  }
  for(const regularization of ridges)for(const threshold of thresholds) {
    let active=columns.map((_,i)=>i).filter(i=>scales[i]>0),beta=[];
    for(let iteration=0;iteration<12;iteration++) {
      beta=ridge(active,regularization);if(!beta){active=[];break;}
      const next=active.map((id,j)=>({id,m:Math.abs(beta[j])})).filter(x=>x.m>=threshold).sort((a,b)=>b.m-a.m||a.id-b.id).slice(0,maxTerms).map(x=>x.id).sort((a,b)=>a-b);
      if(next.join(',')===active.join(','))break;active=next;
    }
    beta=ridge(active,regularization)||[];
    const weights=beta.map((v,k)=>v*ys/scales[active[k]]),residual=target.map((v,j)=>v-active.reduce((s,id,k)=>s+weights[k]*columns[id][j],0));
    out.push({ids:active,weights,residual,rmse:Math.sqrt(meanSquare(residual)),threshold,regularization});
  }
  return out;
}

/** Fits use observed states only. Whole separate recordings choose executable
 * candidates. Residual screening is deliberately not a structural certificate:
 * correlated windows and noisy nonlinear features have no calibrated likelihood.
 */
export function discoverTrajectoryEvolution(training,selection,options={}) {
  const {method='weak',estimator='beam',maxTerms=4,beam=6,smoothingPoints=11,forecastInitialization='polynomial',prefixPoints=17,selectionScaling='raw',thresholds=[.025,.05,.1,.2],ridges=[1e-6,1e-3,.1],adequacyNoiseMultiplier=3,adequacySignalFraction=.03}=options;
  requireState(Array.isArray(training)&&training.length>=1&&training.length<=6,'Require fitting recordings');
  requireState(Array.isArray(selection)&&selection.length>=1&&selection.length<=3,'Require independent selection recordings');
  requireState(['beam','stlsq','free-stlsq'].includes(estimator)&&Number.isInteger(maxTerms)&&maxTerms>=1&&maxTerms<=(options.grammar?.basis==='extended-state'?12:4)&&Number.isInteger(beam)&&beam>=1&&beam<=12,'Invalid sparse search budget');
  requireState(['raw','channel-noise'].includes(selectionScaling),'Invalid selection scaling');
  requireState(Array.isArray(thresholds)&&thresholds.length>=1&&thresholds.length<=8&&thresholds.every(x=>Number.isFinite(x)&&x>=0),'Invalid STLSQ thresholds');
  requireState(Array.isArray(ridges)&&ridges.length>=1&&ridges.length<=4&&ridges.every(x=>Number.isFinite(x)&&(estimator==='free-stlsq'?x>=0:x>0)&&x<=1),'Invalid ridge menu');
  requireState([adequacyNoiseMultiplier,adequacySignalFraction].every(x=>Number.isFinite(x)&&x>=0),'Invalid residual screen');
  const all=[...training,...selection];requireState(new Set(all.map(r=>r.id)).size===all.length,'Fitting and selection recordings must be disjoint');
  requireState(['polynomial','prefix-shooting'].includes(forecastInitialization),'Unknown forecast initialization');
  requireState(Number.isInteger(prefixPoints)&&prefixPoints>=5&&prefixPoints<=33,'Invalid forecast prefix');
  const candidateBudget=estimator==='beam'?1+beam*maxTerms:thresholds.length*ridges.length;
  const forecastCells=selection.reduce((s,run)=>{const p=validateStateTrajectory(run);const prefixCost=forecastInitialization==='prefix-shooting'?prefixPoints*p.n*(1+4*(p.n+4))*8:0;return s+Math.max(0,p.length-(forecastInitialization==='prefix-shooting'?prefixPoints:smoothingPoints))*p.n*8+prefixCost;},0)*candidateBudget;
  requireState(forecastCells<=20000000,'Aggregate selection forecast work budget exceeded');
  const trees=trajectoryOperatorGrammar(training[0]?.kind,options.grammar),eq=stateOperatorEquations(training,trees,options);
  requireState(eq.kind!=='kinetic'||estimator!=='stlsq','Kinetic fitting requires beam or free-stlsq');
  const featureBank=eq.features??trees.map(tree=>({tree}));
  const free=estimator==='free-stlsq'?fitFreeWeakSTLSQ(eq.outputEquations??[{columns:eq.columns,target:eq.target}],{thresholds,ridges,maxFits:options.maxFits??257,maxWorkPerRow:options.maxWorkPerRow??50000000}):null;
  const fits=free?free.candidates.map(c=>({fitStatus:c.status,fitDiagnostics:c.equations,threshold:c.threshold,regularization:c.ridge,
    model:c.status==='converged'?{schema:'worldlaw.symbolic-evolution/v1',kind:eq.kind,terms:c.equations.flatMap((row,channel)=>row.active.map((id,j)=>({tree:trees[id],weight:row.coefficients[j],...(eq.kind==='kinetic'?{channel}:{})})))}:null,
    rmse:c.status==='converged'?Math.sqrt(meanSquare(c.equations.map(row=>row.trainRmse))):null,
    dataRankDeficient:c.equations.some(row=>row.dataRankDeficient===true)})):
    estimator==='beam'?sparseBeam(eq,maxTerms,beam):thresholdFits(eq,maxTerms,thresholds,ridges);
  const prepared=selection.map(r=>prepareStateTrajectory(r,smoothingPoints)),ranked=[];
  const channelScales=selectionScaling==='channel-noise'?selection.map(channelNoiseScales):null;
  for(const fit of fits) {
    if(fit.fitStatus==='refused'){ranked.push({model:null,trainingRmse:null,selectionRmse:Infinity,noiseSigma:null,signalRms:null,score:Infinity,diverged:true,threshold:fit.threshold,regularization:fit.regularization,fitStatus:'refused',fitDiagnostics:fit.fitDiagnostics});continue;}
    const model=fit.model??{schema:'worldlaw.symbolic-evolution/v1',kind:eq.kind,terms:fit.ids.map((id,j)=>({...featureBank[id],weight:fit.weights[j]}))};
    let squared=0,signal=0,count=0,noise=0,diverged=false;
    for(let j=0;j<selection.length;j++) {
      const forecast=forecastStateTrajectory(model,selection[j],{smoothingPoints,prepared:prepared[j],initialization:forecastInitialization,prefixPoints});
      if(forecast.status!=='forecast'){diverged=true;break;}
      if(selectionScaling==='raw'){
        const n=(forecast.states.length-1)*prepared[j].n;
        squared+=forecast.rmse**2*n;count+=n;noise+=prepared[j].noiseSigma**2*n;
        for(let k=forecast.startIndex+1;k<selection[j].samples.length;k++)for(const v of selection[j].samples[k].state)signal+=v*v;
      }else{
        for(let k=1;k<forecast.states.length;k++)for(let d=0;d<prepared[j].n;d++){
          const scale=channelScales[j][d],observed=selection[j].samples[forecast.startIndex+k].state[d];
          squared+=((forecast.states[k][d]-observed)/scale)**2;signal+=(observed/scale)**2;noise++;count++;
        }
      }
    }
    const rmse=diverged?Infinity:Math.sqrt(squared/count),noiseSigma=diverged?null:Math.sqrt(noise/count),signalRms=diverged?null:Math.sqrt(signal/count);
    const score=rmse+.02*(noiseSigma||0)*model.terms.length;
    ranked.push({model,trainingRmse:fit.rmse,selectionRmse:rmse,noiseSigma,signalRms,score,diverged,threshold:fit.threshold,regularization:fit.regularization,...(free?{fitStatus:fit.fitStatus,fitDiagnostics:fit.fitDiagnostics,dataRankDeficient:fit.dataRankDeficient}:{})});
  }
  ranked.sort((a,b)=>a.score-b.score||(a.model?.terms.length??Infinity)-(b.model?.terms.length??Infinity)||(a.model?.terms.reduce((s,t)=>s+size(t.tree),0)??Infinity)-(b.model?.terms.reduce((s,t)=>s+size(t.tree),0)??Infinity));
  const best=ranked[0];requireState(best,'No model candidates');
  const tolerance=best.diverged?null:adequacyNoiseMultiplier*best.noiseSigma+adequacySignalFraction*best.signalRms;
  const adequate=!best.diverged&&best.selectionRmse<=tolerance;
  const clean=r=>({...r,selectionRmse:Number.isFinite(r.selectionRmse)?r.selectionRmse:null,score:Number.isFinite(r.score)?r.score:null});
  return {schema:'worldlaw.trajectory-operator-discovery/v1',status:adequate?'predictive_candidate':'abstained',reason:adequate?'selection_residual_within_declared_screen':'selection_forecast_mismatch',structuralIdentification:false,model:best.model,frontier:ranked.filter(r=>!r.diverged).slice(0,8).map(r=>r.model),selection:clean(best),candidates:ranked.map(clean),diagnostics:{method,estimator,...(free?{freeSupport:true,supportCap:null,normalization:free.normalization}:{}),...(eq.kind==='kinetic'?{outputChannels:2}:{}),...(selectionScaling!=='raw'?{selectionScaling}:{}),grammarSize:trees.length,equationCount:eq.target.length,coverage:eq.coverage,tolerance,selectionIds:selection.map(r=>r.id),initialization:forecastInitialization==='prefix-shooting'?'fixed '+prefixPoints+'-sample trajectory fit; all later states withheld from integration':'prefix-only local cubic; all later states withheld from integration',limitations:['Bounded oscillator, two-channel kinetic and periodic scalar-field grammar.','Noisy nonlinear regressors and overlapping windows are not independent likelihood observations.','Residual screening is not calibrated OOD rejection or a unique structural identification.','Selection recordings are consumed by model selection; external test recordings remain separate.']}};
}

function channelNoiseScales(run){
  const n=run.samples[0].state.length,scales=[];
  for(let d=0;d<n;d++){
    const differences=[];
    for(let j=1;j<run.samples.length-1;j++)differences.push(Math.abs(run.samples[j-1].state[d]-2*run.samples[j].state[d]+run.samples[j+1].state[d]));
    differences.sort((a,b)=>a-b);
    scales.push(Math.max(1e-8,differences[Math.floor(differences.length/2)]/(.6744897501960817*Math.sqrt(6))));
  }
  return scales;
}
