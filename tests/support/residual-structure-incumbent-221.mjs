import {physicalDelayPairs} from '../../src/trajectory/physical-delay.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
function admit(rows){
  check(Array.isArray(rows)&&rows.length>=4&&rows.length<=10000,'A complete prediction needs 4–10000 original rows.');
  return Array.from(rows,(row,index)=>{
    check(row&&[row.time,row.observed,row.predicted].every(Number.isFinite),'Every original row needs finite time, observed and predicted angles.');
    check(Math.abs(row.observed)<=1e6&&Math.abs(row.predicted)<=1e6,'Angles exceed the maintained one-million-radian execution bound.');
    if(index)check(row.time>rows[index-1].time&&Number.isFinite(row.time-rows[0].time),'Original times must strictly increase with finite elapsed intervals.');
    return {index,time:row.time,observed:row.observed,predicted:row.predicted,residual:row.observed-row.predicted};
  });
}
function norm(values){if(values.length<=20000)return Math.hypot(...values);let result=0;for(const value of values)result=Math.hypot(result,value);return result;}
function summarize(source,groups,pairCount){
  const samples=source.slice(1),count=samples.length;
  const scale=Math.max(...samples.map(row=>Math.abs(row.residual)));
  const normalized=samples.map(row=>scale===0?0:row.residual/scale);
  const mean=normalized.reduce((sum,value)=>sum+value,0)/count;
  const centered=normalized.map(value=>value-mean);
  const reports=groups.map(group=>{
    const pairs=group.indices.map(([i,j])=>({earlier:{...source[i]},later:{...source[j]},elapsed:source[j].time-source[i].time}));
    const left=group.indices.map(([i])=>centered[i-1]),right=group.indices.map(([,j])=>centered[j-1]);
    const leftNorm=norm(left),rightNorm=norm(right);
    const correlation=pairs.length>=2&&leftNorm&&rightNorm?Math.max(-1,Math.min(1,left.reduce((sum,value,i)=>sum+(value/leftNorm)*(right[i]/rightNorm),0))):null;
    const differenceNorm=norm(group.indices.map(([i,j])=>normalized[j-1]-normalized[i-1]));
    const pairNorm=norm([...group.indices.map(([i])=>normalized[i-1]),...group.indices.map(([,j])=>normalized[j-1])]);
    const {indices,...metadata}=group;
    return {...metadata,count:pairs.length,correlation,differenceRatio:pairNorm?(differenceNorm/pairNorm)**2:null,
      elapsedMinimum:pairs.length?pairs.reduce((v,p)=>Math.min(v,p.elapsed),Infinity):null,
      elapsedMaximum:pairs.length?pairs.reduce((v,p)=>Math.max(v,p.elapsed),-Infinity):null,pairs,
      status:pairs.length<2?(pairs.length?'single_pair':'no_pairs'):correlation===null?'no_centered_variation':'descriptive'};
  });
  return {schema:'worldlaw.residual-structure/v1',count,excludedInitialIndex:0,meanError:mean*scale,
    rmse:Math.hypot(...normalized)/Math.sqrt(count)*scale,centeredRMS:Math.hypot(...centered)/Math.sqrt(count)*scale,pairCount,reports,
    meaning:'Centered lag cosine uses the complete receiving mean. Pairs overlap; these are descriptive sample lags, not independent repetitions, frequency estimates or significance tests.'};
}
export function residualStructure(rows,{lags=[1,2,5,10],maxPairs=100000}={}){
  const source=admit(rows),count=source.length-1;
  check(Number.isSafeInteger(maxPairs)&&maxPairs>=1&&maxPairs<=640000,'Declare a pair budget between 1 and 640000.');
  check(Array.isArray(lags)&&lags.length>=1&&lags.length<=64&&new Set(lags).size===lags.length&&Array.from(lags).every(k=>Number.isSafeInteger(k)&&k>=1&&k<rows.length-2),
    'Declare 1–64 unique positive sample lags, each leaving at least two pairs.');
  const pairCount=lags.reduce((sum,lag)=>sum+count-lag,0);
  check(pairCount<=maxPairs,'The complete declared lag population exceeds the pair budget.');
  return summarize(source,lags.map(lag=>({lag,indices:Array.from({length:count-lag},(_,i)=>[i+1,i+1+lag])})),pairCount);
}
export function physicalResidualStructure(rows,{bands,maxPairs=100000}={}){
  const source=admit(rows),selection=physicalDelayPairs(source.map(row=>row.time),bands,{maxPairs});
  const result=summarize(source,selection.reports.map(r=>({lowerSeconds:r.lowerSeconds,upperSeconds:r.upperSeconds,indices:r.pairs.map(p=>[p.earlierIndex,p.laterIndex])})),selection.pairCount);
  return {...result,schema:'worldlaw.physical-residual-structure/v1',meaning:selection.interpretation+' Centered cosine uses the complete receiving mean, unchanged across bands. Empty and single-pair bands do not define correlation.'};
}
