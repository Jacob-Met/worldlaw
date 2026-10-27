import {remainingOverlap} from './remaining-overlap.mjs';
import {planExperiment,evaluate} from './torque-discovery.mjs';
import {inspectInputEnclosures} from './input-enclosure.mjs';
import {screenIntervalPairs,selectSeparatingCandidate} from '../experiment-design/interval-separation.mjs';
export function planBoundedScalarExperiment(discovery,candidateInputs,radii,{tiePolicy='offered-order'}={}){
 if(!['offered-order','remaining-overlap'].includes(tiePolicy))throw Error('Choose a supported scalar pair-tie policy.');
 if(discovery?.schema!=='worldlaw.discovery/v1'||!Array.isArray(discovery.competitive)||!discovery.competitive.length||discovery.competitive.length>256)throw new Error('Expected a bounded discovery ensemble');
 const models=discovery.competitive;models.forEach(m=>evaluate(m,[]));
 if(!Array.isArray(candidateInputs)||!candidateInputs.length||candidateInputs.length>4096)throw new Error('Provide 1–4096 permitted inputs');
 evaluate(models[0],candidateInputs.map(row=>({...row,jointTorque:0})));
 inspectInputEnclosures(models[0],[],radii);
 const evaluations=models.length*candidateInputs.length,pairComparisons=candidateInputs.length*models.length*(models.length-1)/2;
 if(evaluations>8192||pairComparisons>65536)return{status:'work-limit',selected:null,ranked:[],modelIds:models.map(m=>m.id),evaluations,pairComparisons,pairLimit:65536,limit:8192,nominal:null};
 const nominal=planExperiment(discovery,candidateInputs);
 const reports=models.map(m=>inspectInputEnclosures(m,candidateInputs.map(row=>({...row,jointTorque:0})),{...radii,jointTorque:0}));
 const ranked=candidateInputs.map((input,index)=>{
 const intervals=reports.map((r,i)=>({id:models[i].id,interval:r.rows[index].prediction}));
 const pairs=screenIntervalPairs(intervals,radii.jointTorque),separated=pairs.filter(p=>p.separable).length;
 const extrapolation=['command','position','rate'].filter(k=>discovery.selected.domain&&(input[k]-radii[k]<discovery.selected.domain[k].min||input[k]+radii[k]>discovery.selected.domain[k].max));
 return{index,input:{command:input.command,position:input.position,rate:input.rate},intervals,pairs,separated,extrapolation,allSeparated:pairs.length>0&&separated===pairs.length,withinBudget:true,cost:1,predictions:intervals.map(p=>({modelId:p.id,interval:p.interval})),disagreement:Math.max(...intervals.map(p=>p.interval[1]))-Math.min(...intervals.map(p=>p.interval[0]))};
 });
 let selected=selectSeparatingCandidate(ranked,'index','cost');
 if(tiePolicy==='remaining-overlap'){for(const row of ranked)row.remainingOverlap=remainingOverlap(row.intervals,radii.jointTorque);if(selected)selected=ranked.filter(r=>r.allSeparated===selected.allSeparated&&r.separated===selected.separated&&r.cost===selected.cost).sort((a,b)=>a.remainingOverlap.maximum-b.remainingOverlap.maximum||a.index-b.index)[0];}
 return{...(tiePolicy==='remaining-overlap'?{tiePolicy}:{}),status:selected?'proposed':'uninformative',selected,ranked,modelIds:models.map(m=>m.id),evaluations,pairComparisons,pairLimit:65536,limit:8192,nominal,separation:selected?.allSeparated?'full':selected?'partial':'none',radii:{...radii},method:'declared_input_box_interval_separation'};
}
