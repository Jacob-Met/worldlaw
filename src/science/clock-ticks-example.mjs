import {affineClockExample} from './clock-affine-example.mjs';
/** Authored sampling grid with two independently declared device tick origins.
 * Timestamp strings resemble recorder exports; these are not physical readings.
 */
export function clockTicksExample(){
 const {model,input}=affineClockExample();delete input.stateOrigin;delete input.torqueOrigin;
 const stateOrigin=1792886400000000000n,torqueOrigin=82710000000n;
 return {schema:'worldlaw.clock-tick-investigation/v1',model,input:{...input,schema:'worldlaw.clock-tick-input/v1',source:'Authored two-recorder tick export — not physical evidence',units:{...input.units,time:'ticks'},clocks:{state:{origin:String(stateOrigin),ticksPerSecond:'1000000000'},torque:{origin:String(torqueOrigin),ticksPerSecond:'1000'}},maximumRoundingErrorSeconds:1e-12,
  states:input.states.map(({time,...row})=>({...row,timestampTicks:String(stateOrigin+BigInt(Math.round(time*1e9)))})),
  torques:input.torques.map(({time,...row})=>({...row,timestampTicks:String(torqueOrigin+BigInt(Math.round(time*1000)))})),
 }};
}
