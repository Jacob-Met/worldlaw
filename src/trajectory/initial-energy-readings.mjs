/** Original-row necessary-condition comparison, not physical-law identification. */
import {normalizeAngularForecastRun} from './angular-discovery.mjs';
import {prepareInvariantInput} from './initial-energy-input.mjs';
import {confineDampedSine} from './initial-energy.mjs';
import {rational,add,sub,cmp,serial,enclosure} from '../unknown-lab/chronos-exact-halfplanes.mjs';

export function admitEnergyReadingDeclaration(value){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,'angleReadingHalfWidth'))throw Error('Declare only angleReadingHalfWidth for the reading comparison.');
 const radius=value.angleReadingHalfWidth;
 if(typeof radius!=='number'||!Number.isFinite(radius)||radius<0||radius>100)throw Error('Declare a finite angle-reading half-width from 0 to 100 rad.');
 return {angleReadingHalfWidth:radius};
}

/** Recompute from original inputs; no caller-supplied cached bound is admitted. */
export function prepareInitialEnergyReadingQuestion(model,rawRun,widths,declaration){
 const readingComparison=admitEnergyReadingDeclaration(declaration);
 const run=normalizeAngularForecastRun(rawRun);
 const options={positionHalfWidth:widths?.positionHalfWidth,rateHalfWidth:widths?.rateHalfWidth};
 const input=prepareInvariantInput(model,{kind:'supplied-point-state',runId:run.id,position:run.samples[0].position,rate:run.initialRate},options);
 const result=confineDampedSine(input);
 const source={schema:'worldlaw.initial-state-receipt/v1',model:structuredClone(model),run,options,readingComparison};
 if(result.status!=='confined')return {source,input,result,readingResult:{status:'unavailable',reason:'No complete model limit established.',rows:[]}};
 const [lower,upper]=result.positionRaw.map(x=>[BigInt(x),1n<<80n]);
 const radius=rational(readingComparison.angleReadingHalfWidth);
 let required=rational(0),attainingIndexes=[];
 // Maintained run admission bounds the complete population to 4096 rows.
 // Two endpoint operations, two boundary comparisons and at most one gap
 // subtraction per row; failure returns no partial report.
 const rows=run.samples.map((row,index)=>{
  const value=rational(row.position),lo=sub(value,radius),hi=add(value,radius);
  const above=cmp(lo,upper)>0,below=cmp(hi,lower)<0;
  const gap=above?sub(lo,upper):below?sub(lower,hi):rational(0);
  const distance=cmp(value,lower)<0?sub(lower,value):cmp(value,upper)>0?sub(value,upper):rational(0);
  const order=cmp(distance,required);
  if(order>0){required=distance;attainingIndexes=[index];}else if(order===0)attainingIndexes.push(index);
  return {index,time:row.time,position:row.position,interval:[serial(lo),serial(hi)],status:above||below?'separated':'inconclusive',side:above?'above':below?'below':null,gap:serial(gap)};
 });
 const overlapThreshold={exact:serial(required),binary64Enclosure:enclosure(required),zero:cmp(required,rational(0))===0,withinDeclaredRadiusLimit:cmp(required,rational(100))<=0,attainingRows:attainingIndexes.map(index=>({index,time:rows[index].time,position:rows[index].position})),meaning:'Smallest uniform reading half-width for every interval to overlap this unchanged outer model bound; not calibrated uncertainty or proof of a common trajectory.'};
 return {source,input,result,readingResult:{status:rows.some(row=>row.status==='separated')?'conjunction_rejected':'inconclusive',rows,separatedCount:rows.filter(row=>row.status==='separated').length,overlapThreshold,work:{rowCount:rows.length,maxEndpointAndGapOperations:3*rows.length,boundaryComparisons:2*rows.length,maxThresholdSubtractions:rows.length,maxThresholdRowComparisons:3*rows.length,thresholdFinalComparisons:2,thresholdDirectedProjections:1}}};
}
