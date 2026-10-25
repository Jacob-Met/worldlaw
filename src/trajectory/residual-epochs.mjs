import {physicalResidualStructure} from './residual-structure.mjs';
import {residualNorm,residualPairStatistics} from './residual-pair-statistics.mjs';
const insist=(ok,message)=>{if(!ok)throw new Error(message);};
/** Complete source-time attribution of one already executed frozen forecast. */
export function residualEpochs(rows,{boundaries,bands,maxPairs=100000}={}){
  insist(Array.isArray(boundaries)&&boundaries.length>=2&&boundaries.length<=33,
    'Declare 2–33 ordered source-time boundaries covering the complete recording.');
  const limits=Array.from(boundaries);
  insist(limits.every(Number.isFinite)&&limits.every((t,i)=>!i||t>limits[i-1]),
    'Source-time boundaries must be finite and strictly increasing.');
  insist(limits[0]===rows?.[0]?.time&&limits.at(-1)===rows?.at(-1)?.time,
    'Boundaries must exactly cover the original initial through final source timestamps.');
  // Reuse the maintained original-row admission, all-band budget and arithmetic.
  const physical=physicalResidualStructure(rows,{bands,maxPairs});
  const source=rows.map((row,index)=>({index,time:row.time,observed:row.observed,predicted:row.predicted,residual:row.observed-row.predicted}));
  const scale=Math.max(...source.slice(1).map(r=>Math.abs(r.residual)));
  const normalized=source.slice(1).map(r=>scale?r.residual/scale:0);
  const mean=normalized.reduce((sum,value)=>sum+value,0)/normalized.length;
  const centered=normalized.map(value=>value-mean),totalNorm=residualNorm(normalized);
  const groups=limits.slice(0,-1).map((start,i)=>({epochIndex:i,startExclusive:start,endInclusive:limits[i+1],rowIndices:[]}));
  const epochForIndex=new Int32Array(source.length);epochForIndex.fill(-1);
  let epoch=0;
  for(let i=1;i<source.length;i++){
    while(source[i].time>limits[epoch+1])epoch++;
    epochForIndex[i]=epoch;groups[epoch].rowIndices.push(i);
  }
  const epochs=groups.map(group=>{
    const values=group.rowIndices.map(i=>normalized[i-1]),norm=residualNorm(values),count=values.length;
    return {...group,count,status:count?'observed':'no_receiving_rows',
      meanError:count?values.reduce((sum,x)=>sum+x,0)/count*scale:null,
      rmse:count?norm/Math.sqrt(count)*scale:null,
      maxAbsError:count?Math.max(...group.rowIndices.map(i=>Math.abs(source[i].residual))):null,
      squaredErrorFraction:totalNorm?(norm/totalNorm)**2:null};
  });
  const pairPartitions=physical.reports.map((report,bandIndex)=>{
    const within=epochs.map(e=>({epochIndex:e.epochIndex,pairIndices:[]})),crossPairs=[];
    report.pairs.forEach((pair,pairIndex)=>{
      const earlierEpoch=epochForIndex[pair.earlier.index],laterEpoch=epochForIndex[pair.later.index];
      if(earlierEpoch===laterEpoch)within[earlierEpoch].pairIndices.push(pairIndex);
      else crossPairs.push({pairIndex,earlierEpoch,laterEpoch});
    });
    const summarize=pairIndices=>{
      const indices=pairIndices.map(i=>[report.pairs[i].earlier.index,report.pairs[i].later.index]);
      const statistics=residualPairStatistics(normalized,centered,indices);
      return {count:indices.length,...statistics,status:indices.length<2?(indices.length?'single_pair':'no_pairs'):statistics.correlation===null?'no_centered_variation':'descriptive'};
    };
    const withinEpochs=within.map(group=>({...group,...summarize(group.pairIndices)}));
    const crossEpoch={pairs:crossPairs,...summarize(crossPairs.map(p=>p.pairIndex))};
    return {bandIndex,withinEpochs,crossEpoch,pairCount:report.count,
      accountedPairCount:withinEpochs.reduce((sum,g)=>sum+g.count,0)+crossEpoch.count};
  });
  return {schema:'worldlaw.residual-epochs/v1',boundaries:limits,source,epochs,pairPartitions,physical,
    excludedInitialIndex:0,sourceCount:source.length-1,
    accountedSourceCount:epochs.reduce((sum,e)=>sum+e.count,0),
    meaning:'Complete left-open/right-closed original source epochs. The imposed initial row is excluded once. No epoch resets a forecast or fits a law. Every physical-delay pair remains within one epoch or explicitly crosses epochs; pair cosine retains the full receiving mean. Epochs are descriptive partitions, not independent experiments, change-point detection or causal explanations.'};
}
