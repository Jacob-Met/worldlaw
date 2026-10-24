import {validateNotebook,evaluateHistory,exportNotebook} from './paired-history.mjs';
import {serialOrderWeights} from './serial-order.mjs';
import {periodicContrastGain} from './periodic-order.mjs';

const require=(ok,message)=>{if(!ok)throw Error(message);};
export const PERIODIC_CONTRAST_SCHEMA='worldlaw.periodic-contrast/v1';

/** Conditional sensitivity, not a fitted artifact or calibrated confidence interval. */
export function inspectPeriodicContrast(raw){
 require(raw?.schema===PERIODIC_CONTRAST_SCHEMA,'Expected periodic-contrast inputs v1.');
 const notebook=validateNotebook(raw.notebook),original=evaluateHistory(notebook);
 require(original.order.status==='counterbalanced','Recorded counterbalanced order with at least four pairs in each direction is required.');
 require(typeof raw.sourceNote==='string'&&raw.sourceNote.trim().length>0&&raw.sourceNote.length<=2000,'Declare a source or basis for the artifact bounds (up to 2000 characters).');
 require(raw.periodUnit==='acquisition_steps'&&raw.amplitudeUnit==='N*m','Declare acquisition_steps periods and N*m amplitude bounds.');
 const components=raw.components;
 require(Array.isArray(components)&&components.length>=1&&components.length<=16&&Array.from({length:components.length},(_,i)=>Object.hasOwn(components,i)).every(Boolean),'Declare 1–16 sinusoidal components.');
 const periods=new Set();
 const declared=components.map(c=>{
  require(typeof c?.period==='number'&&Number.isFinite(c.period)&&c.period>=1&&c.period<=1e6,'Periods must be finite, from 1 to 1000000 acquisition steps.');
  require(!periods.has(c.period),'Repeated periods are not separate components; explicitly combine their amplitude bounds.');periods.add(c.period);
  require(typeof c.amplitudeBound==='number'&&Number.isFinite(c.amplitudeBound)&&c.amplitudeBound>=0&&c.amplitudeBound<=1e3,'Amplitude bounds must be finite from 0 to 1000 N*m.');
  return {period:c.period,amplitudeBound:c.amplitudeBound};
 });
 const pairs=notebook.pairs.map(p=>({reference:p.reference.sampleIndex,conditioned:p.conditioned.sampleIndex}));
 const weights=serialOrderWeights(pairs),indices=weights.map(w=>w.sampleIndex),origin=Math.min(...indices);
 require(Math.max(...indices)-origin<=1e6,'Recorded acquisition span exceeds 1000000 steps. No observations were dropped.');
 const artifacts=declared.map(c=>{
  const response=periodicContrastGain(weights,c.period,origin);
  // A*cos(phase+phi): response A*(C*cos(phi)-S*sin(phi)).
  const maximizingPhaseRadians=response.gain===0?0:Math.atan2(-response.sine,response.cosine);
  return {...c,...response,biasBound:c.amplitudeBound*response.gain,maximizingPhaseRadians};
 });
 const biasBound=artifacts.reduce((sum,c)=>sum+c.biasBound,0);
 const estimate=original.decisionDifference;
 const artifactOnlyInterval=[estimate-biasBound,estimate+biasBound];
 const screenedInterval=[artifactOnlyInterval[0]-original.boundary,artifactOnlyInterval[1]+original.boundary];
 const numericalTolerance=64*Number.EPSILON*(1+Math.abs(estimate)+biasBound+original.boundary);
 const excludesZero=screenedInterval[0]>numericalTolerance||screenedInterval[1]<-numericalTolerance;
 const witness=weights.map(({sampleIndex,weight})=>({sampleIndex,weight,
  sensorOffset:artifacts.reduce((sum,c)=>sum+c.amplitudeBound*Math.cos(2*Math.PI*((sampleIndex-origin)%c.period)/c.period+c.maximizingPhaseRadians),0)}));
 const witnessContrast=witness.reduce((sum,w)=>sum+w.weight*w.sensorOffset,0);
 return {inputs:{schema:PERIODIC_CONTRAST_SCHEMA,notebook:JSON.parse(exportNotebook(notebook)),sourceNote:raw.sourceNote,periodUnit:raw.periodUnit,amplitudeUnit:raw.amplitudeUnit,components:declared},
  original,origin,artifacts,biasBound,artifactOnlyInterval,screenedInterval,numericalTolerance,
  status:excludesZero?'contrast-remains-outside-screen':'artifact-sensitive-or-unresolved',
  witness,witnessContrast,witnessResidual:witnessContrast-biasBound,
  interpretation:'All declared sinusoidal components may coexist with independently chosen phases. This is a conditional worst-case bias calculation, not an estimated artifact, probability or physical cause. The original empirical three-standard-error screen is retained as a descriptive screen, not recomputed after a fitted correction. Its combination with declared bias bounds is not calibrated coverage. Undeclared periods, nonstationary drift, carryover and incorrect bounds remain outside the calculation.'};
}
