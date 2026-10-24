import {cycleExample} from './core.mjs';
import {ANGLE_BOX_SCHEMA,ANGLE_BOX_ASSUMPTION} from './angle-boxes.mjs';
export function angleBoxExample(kind='narrow'){
 if(!['narrow','zero-compatible','independent-return-rows'].includes(kind))throw Error('Unknown angle-box control.');
 const cycle=cycleExample();cycle.source='Authored angle-box cancellation control; not a physical acquisition';
 cycle.samples=[{position:0,jointTorque:0,torqueRadius:0},{position:1,jointTorque:2,torqueRadius:1e12},{position:0,jointTorque:4,torqueRadius:0}];
 if(kind==='independent-return-rows')cycle.samples.splice(2,0,{position:1,jointTorque:3,torqueRadius:0});
 const radius=kind==='zero-compatible'?.5:.125;
 return {schema:ANGLE_BOX_SCHEMA,assumption:ANGLE_BOX_ASSUMPTION,radiusSource:'Authored deterministic angular boxes; not calibrated sensor uncertainty',cycle,positionRadii:cycle.samples.map(()=>radius)};
}
