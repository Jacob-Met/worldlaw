import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readRealAIGymCsv,replayActuatorPort} from '../src/coupling/actuator-port.mjs';
const dir=process.argv[2],dest=process.argv[3];
const manifest=JSON.parse(readFileSync(resolve(dir,'source-manifest.json')));
const rows=[];
for(const trial of manifest.trials){
  const data=readFileSync(resolve(dir,trial.sha256+'.csv'));
  if (createHash('sha256').update(data).digest('hex')!==trial.sha256) throw new Error('Source digest changed');
  const fraction=parseInt(trial.sha256.slice(0,8),16)/2**32;
  try{
    const recording=readRealAIGymCsv(data.toString('utf8'));
    const replay=replayActuatorPort(recording,fraction);
    rows.push({source:trial.sha256,mount:trial.mount,controller:trial.controller,run:trial.trial,
      expected:trial.mount==='acrobot'?'elbow':'shoulder',thresholdReached:replay.thresholdReached,anchor:replay.anchor,results:replay.results});
  }catch(error){rows.push({source:trial.sha256,mount:trial.mount,controller:trial.controller,run:trial.trial,error:error.message});}
}
const result={source:manifest.source,total:rows.length,rows};
writeFileSync(dest,JSON.stringify(result,null,2));
for(const mode of ['first','fixed100','fixed350','uniform','active']){
  const ok=rows.filter(r=>r.results);
  const times=ok.map(r=>r.results[mode].elapsed).sort((a,b)=>a-b);
  console.log(mode,ok.filter(r=>r.results[mode].winner===r.expected).length,ok.length,'median time',(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2);
}
console.log('excluded',rows.filter(r=>r.error).map(r=>[r.run,r.error]));
