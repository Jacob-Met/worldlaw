/** Retrospective necessary-condition witness, not a common-course solver. */
import {inspectCoupledResponseRegions,screenResponseRegion} from './response-region.mjs';
import {requireThat} from './science.mjs';
import {checkLinearEnvelopeSeparator} from '../science/shared-training-check.mjs';
export const CONTRAST_SCHEMA='worldlaw.coupled-response-contrast-inputs/v1';
export const CONTRAST_MAX_BYTES=4*1024*1024;
export function inspectResponseContrast(report,modelId,rowIndices){
 requireThat(report?.schema==='worldlaw.coupled-response-region/v1','A computed retained response-region report is required.');
 requireThat(Array.isArray(rowIndices)&&rowIndices.length===2&&rowIndices.every(i=>Number.isInteger(i)&&i>=0&&i<report.receivingCount)&&rowIndices[0]!==rowIndices[1],'Select two distinct original receiving rows.');
 const candidate=report.candidates.find(c=>c.modelId===modelId);
 requireThat(candidate?.status==='computed',candidate?.reason??'The selected fitted structure is unavailable.');
 const [a,b]=rowIndices.map(i=>candidate.rows[i]);
 requireThat(a.generators.length===b.generators.length&&a.generators.length===report.trainingIds.length*2,'The retained reading generators are not aligned.');
 const center=a.center.map((v,i)=>v-b.center[i]),observed=a.observed.map((v,i)=>v-b.observed[i]),readingRadius=a.readingRadius.map((v,i)=>v+b.readingRadius[i]);
 const generators=a.generators.map((g,i)=>g.map((v,axis)=>v-b.generators[i][axis]));
 requireThat([...center,...observed,...readingRadius,...generators.flat()].every(Number.isFinite),'The selected contrast arithmetic became nonfinite.');
 const sourceMagnitude=Math.max(1,...[a,b].flatMap(r=>[...r.center,...r.observed].map(Math.abs)));
 const screened=screenResponseRegion(center,generators,observed,readingRadius,sourceMagnitude);
 const normal=screened.witness.normal,dot=g=>normal[0]*g[0]+normal[1]*g[1];
 // Generators already include the declared training radius, so unit-box offsets
 // let the maintained checker consume them without dividing by a zero radius.
 // Preserve original rows before cancellation, with their underlying screens.
 const envelopeRows=[a,b].flatMap(r=>[0,1].map(axis=>({influence:r.generators.map(g=>g[axis]),observedTorque:r.observed[axis],refittedPrediction:r.center[axis],independentCoefficientBoxRadius:r.generators.reduce((sum,g)=>sum+Math.abs(g[axis]),0),numericalTolerance:r.witness.numericalTolerance})));
 const checked=checkLinearEnvelopeSeparator(envelopeRows,[...normal,...normal.map(x=>-x)],1,[...a.readingRadius,...b.readingRadius]);
 requireThat(Number.isFinite(checked.gap),'The maintained shared-envelope checker could not assess this contrast.');
 const status=checked.status==='verified-separation'?'outside':checked.gap>=-checked.numericalTolerance?'numerical-boundary':'not-excluded';
 const witness={...screened.witness,support:checked.support,gap:checked.gap,numericalTolerance:checked.numericalTolerance,trainingSigns:checked.trainingProjection.map(Math.sign)};
 const independentTrainingSupport=[a,b].reduce((sum,r)=>sum+r.generators.reduce((s,g)=>s+Math.abs(dot(g)),0),0);
 const receivingSupport=readingRadius.reduce((s,r,axis)=>s+r*Math.abs(normal[axis]),0);
 return {schema:'worldlaw.coupled-response-contrast/v1',modelId,label:candidate.label,rowIndices:[...rowIndices],rows:[a,b],center,observed,readingRadius,generators,...screened,status,witness,checked,independentTrainingSupport,receivingSupport,sharedTrainingSupport:checked.trainingSupport,
  trainingIds:[...report.trainingIds],trainingRadius:report.trainingRadius,
  interpretation:'A separated difference rules out one common bounded perturbation of the retained training readings for these two rows, and therefore for the complete course. No separation does not establish the full four-output pair constraints or whole-course feasibility. This is fixed-coordinate, fixed-structure least-squares sensitivity, not a physical-law confidence region.',numericQualification:report.numericQualification};
}
export function serializeResponseContrastInputs(report,modelId,rowIndices){
 inspectResponseContrast(report,modelId,rowIndices);
 const text=JSON.stringify({schema:CONTRAST_SCHEMA,notebook:report.notebook,path:report.path,trainingRadius:report.trainingRadius,modelId,rowIndices},null,2);
 requireThat(new TextEncoder().encode(text).length<=CONTRAST_MAX_BYTES,'Contrast input file exceeds 4 MiB.');return text;
}
export function reopenResponseContrastInputs(text){
 requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=CONTRAST_MAX_BYTES,'Contrast input file exceeds 4 MiB.');
 let raw;try{raw=JSON.parse(text);}catch{throw Error('Contrast input must be valid JSON.');}
 requireThat(raw&&raw.schema===CONTRAST_SCHEMA&&Object.keys(raw).sort().join(',')==='modelId,notebook,path,rowIndices,schema,trainingRadius','Expected original contrast inputs only; stored verdicts are not accepted.');
 const report=inspectCoupledResponseRegions(raw.notebook,raw.path,raw.trainingRadius);
 return {report,contrast:inspectResponseContrast(report,raw.modelId,raw.rowIndices)};
}
