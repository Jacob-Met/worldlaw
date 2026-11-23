import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {synthesizeEvolution,assessEvolution} from '../src/science/operator-synthesis.mjs';
import {verifyEvolutionRollout,designEvolutionExcitation} from '../src/science/operator-rollout.mjs';

const operators=['add','mul','div','sin','cos','tanh','abs'];
const expectedIds=['hidden_delay','hidden_lorenz_state','unseen_second_neighbour'];
const config=kind=>({kind,operators,maxNodes:4,maxCandidates:1200,maxTerms:2,beam:16,tolerance:1e-9});
function check(ok,why){if(!ok)throw new RangeError(why);}
export function runOperatorCourse(source){
  check(source?.schema==='nullgarden.operator-course/v1'&&source.cases?.length===2&&
    source.cases[0].kind==='oscillator'&&source.cases[1].kind==='periodic'&&
    source.outside?.length===3&&source.outside.every((c,i)=>c.id===expectedIds[i]),'Unexpected receiving course');
  const s=source.settings;
  check(s.trainingTolerance===1e-9&&s.heldDerivativeTolerance===1e-9&&s.heldStateTolerance===2e-6&&
    s.resolutionTolerance===2e-6&&s.permutationOffset===7,'Changed registered thresholds');
  const cases=source.cases.map(c=>{
    const ids=c.train.map(t=>t.spec.id);
    check(new Set([...ids,c.held.spec.id]).size===ids.length+1,'Training and challenge ids must be disjoint');
    const configForRun=config(c.kind);
    function evaluate(rows) {
      const f=synthesizeEvolution(rows,configForRun);
      const derivative=assessEvolution(f.model,c.held.rows,s.heldDerivativeTolerance);
      const trajectory=verifyEvolutionRollout(f.model,c.held.spec,c.held.states,{
        maxError:s.heldStateTolerance,resolutionTolerance:s.resolutionTolerance});
      return {accepted:f.status==='candidate'&&derivative.accepted&&trajectory.accepted,status:f.status,model:f.model,
        generated:f.generated,training:f.training,derivative,trajectory};
    }
    return {kind:c.kind,observed:evaluate(c.train.flatMap(t=>t.rows)),shuffled:evaluate(c.train.flatMap(t=>t.shuffled))};
  });
  const outside=source.outside.map(c=>{
    const f=synthesizeEvolution(c.rows,config(c.kind));
    return {id:c.id,status:f.status,maxError:f.training.maxError};
  });
  const oscillator=cases[0].observed.model;
  const simple={schema:'worldlaw.symbolic-evolution/v1',kind:'oscillator',terms:[{tree:'command',weight:1}]};
  const waveform=(id,position,amplitude,endFrequency)=>({id,initial:[position,0],step:0.01,steps:60,
    forcing:{offset:0,amplitude,startFrequency:0.5,endFrequency}});
  const menu=[waveform('quiet',0,0,0.5),waveform('weak',0.15,0.2,0.5),waveform('wide-chirp',2.4,2.1,3)];
  const excitation=designEvolutionExcitation([simple,oscillator],menu);
  return {schema:'worldlaw.received-operator-course/v1',cases,outside,excitation,
    acceptedLaws:cases.filter(c=>c.observed.accepted).length,acceptedShams:cases.filter(c=>c.shuffled.accepted).length,
    acceptedOutside:outside.filter(c=>c.status==='candidate').length};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  if(process.argv.length!==3)throw new RangeError('Pass one Nullgarden operator-course JSON file');
  const report=runOperatorCourse(JSON.parse(readFileSync(process.argv[2],'utf8')));
  console.log(JSON.stringify(report));
  if(report.acceptedLaws!==2 || report.acceptedShams!==0 || report.acceptedOutside!==0 || report.excitation.selected!=='wide-chirp') process.exitCode=1;
}
