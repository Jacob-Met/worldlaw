import {rankObserved} from './noisy-field-intervention.mjs';
import {rollout,DT,N,GRID} from './field-law-dictionary.mjs';
import {searchContinuousExcitation} from '../science/continuous-excitation-search.mjs';
export function fieldInputFromSchedule(layout,waveform) {
  if(!['oscillator','kinetic','periodic'].includes(layout))throw new RangeError('Invalid field drive geometry');
  const profile=layout==='kinetic'?[1,0]:Array.from({length:GRID},(_,j)=>Math.SQRT2*Math.sin(2*Math.PI*j/GRID+.3));
  return {schema:'worldlaw.continuous-input/v1',startTime:0,waveform,...(layout==='oscillator'?{}:{profile})};
}
/** The same four pilot-fitted alternatives as the released finite planner,
 * with continuous frequencies, phases and energy allocation replacing its menu.
 */
export function activeContinuousFieldDesign(pilot,options) {
  const committee=rankObserved([pilot]).slice(0,4);
  const result=searchContinuousExcitation(schedule=>{
    const drive=fieldInputFromSchedule(pilot.layout,schedule);
    const paths=committee.map(c=>rollout(c.law,c.coef,pilot.values[0],drive));
    if(paths.some(x=>!x))throw new RangeError('Field design hypothesis leaves the state domain');
    let separation=Infinity;
    for(let a=0;a<paths.length;a++)for(let b=0;b<a;b++){
      let squares=0,count=0;
      for(let t=4;t<=N;t+=4)for(let j=0;j<pilot.sigma.length;j++){
        squares+=((paths[a][t][j]-paths[b][t][j])/pilot.sigma[j])**2;count++;
      }
      separation=Math.min(separation,squares/count);
    }
    return separation;
  },{...options,duration:DT*N});
  return {...result,drive:result.selected?fieldInputFromSchedule(pilot.layout,result.selected):null,
    committee:committee.map(c=>({law:c.law,coef:c.coef})),initialEstimate:pilot.values[0].slice()};
}
