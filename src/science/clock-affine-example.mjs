import {clockOffsetExample} from './clock-offset-example.mjs';
export function affineClockExample(){
 const {model,input}=clockOffsetExample();
 input.torques.forEach(t=>t.time*=1.01);
 delete input.offsets;
 return {schema:'worldlaw.clock-affine-investigation/v1',model,input:{...input,schema:'worldlaw.clock-affine-input/v1',source:'Authored delayed sensor with 1% clock-rate error — not physical evidence',stateOrigin:0,torqueOrigin:0,hypotheses:[1,1.005,1.01,1.015].flatMap(scale=>[.18,.2,.22].map(offset=>({id:`scale-${scale}-offset-${offset}`,scale,offset:scale*offset})))}};
}
