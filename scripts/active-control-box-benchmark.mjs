#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const [modulePath,mode,casesPath,cohort='anchor',repeatText='5']=process.argv.slice(2);
if(!['before','after'].includes(mode))throw Error('Choose before or after');
const api=await import(pathToFileURL(modulePath));
const all=JSON.parse(readFileSync(casesPath,'utf8'));
const cases=cohort==='anchor'?all.filter(row=>row.name==='coupled_minimum_support'):all.filter(row=>row.request.controlBounds.length<=4);
const repetitions=Number(repeatText);
if(!Number.isSafeInteger(repetitions)||repetitions<1)throw Error('Positive repetitions required');
const q=s=>{const [n,d=1]=String(s).split('/').map(Number);return n/d;};
function corners(request){
  const channels=request.controlBounds[0].min.length;
  let combinations=[[]];
  for(const bound of request.controlBounds)for(let c=0;c<channels;c++){
    const ends=q(bound.min[c])===q(bound.max[c])?[bound.min[c]]:[bound.min[c],bound.max[c]];
    combinations=combinations.flatMap(prior=>ends.map(value=>[...prior,value]));
  }
  return combinations.map(flat=>Array.from({length:request.controlBounds.length},(_,i)=>flat.slice(i*channels,(i+1)*channels)));
}
const numericOrder=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
function incumbent(request){
  let winner=null,potential=0,nodes=0;
  for(const controls of corners(request)){
    const course={...request,schema:api.ACTIVE_LINEAR_FAMILY_SCHEMA,controls};delete course.controlBounds;
    const plan=api.designActiveLinearFamily(course);nodes+=plan.nodes;
    if(plan.exhausted)throw Error('Incumbent exhausted frozen course');
    potential=Math.max(potential,q(plan.potential[0].marginLowerBound));
    if(!plan.selection)continue;
    const row={ticks:plan.selection.map(x=>x.tick),cost:plan.totalCost,margin:q(plan.proof[0].marginLowerBound)};
    const order=winner?(row.ticks.length-winner.ticks.length||row.cost-winner.cost||numericOrder(row.ticks,winner.ticks)): -1;
    if(order<0||(order===0&&row.margin>winner.margin))winner=row;
  }
  return {winner,potential,nodes};
}
function candidate(request){
  const plan=api.designActiveLinearControlBox(request);
  if(plan.exhausted)throw Error('Candidate exhausted frozen course');
  return {winner:plan.selection?{ticks:plan.selection.map(x=>x.tick),cost:plan.totalCost,margin:q(plan.proof[0].marginLowerBound)}:null,
    potential:q(plan.potential[0].marginLowerBound),nodes:plan.nodes};
}
const start=process.hrtime.bigint();let results;
for(let i=0;i<repetitions;i++)results=cases.map(row=>({name:row.name,...(mode==='before'?incumbent(row.request):candidate(row.request))}));
const milliseconds=Number(process.hrtime.bigint()-start)/1e6;
process.stdout.write(JSON.stringify({mode,cohort,repetitions,cases:cases.length,milliseconds,millisecondsPerRepetition:milliseconds/repetitions,maxRSSKiB:process.resourceUsage().maxRSS,results})+'\n');
