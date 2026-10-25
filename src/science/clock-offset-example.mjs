// Authored numerical control; no physical acquisition is claimed.
export function clockOffsetExample() {
  const model={schema:'worldlaw.torque-model/v1',id:'command',terms:[{id:'command',coefficient:1}]};
  const torques=Array.from({length:101},(_,i)=>{const t=i/10;return {time:t,jointTorque:Math.sin(t*1.7)+.2*t};});
  const sample=t=>{let i=Math.floor(t*10);if(i>=100)return torques[100].jointTorque;const f=t*10-i;return torques[i].jointTorque*(1-f)+torques[i+1].jointTorque*f;};
  const states=Array.from({length:32},(_,i)=>{const time=i<16?1+i*.15:6+(i-16)*.15;return {time,position:0,rate:0,command:sample(time+.2),role:i<16?'training':'challenge'};});
  return {schema:'worldlaw.clock-investigation/v1',model,input:{schema:'worldlaw.clock-offset-input/v1',source:'Authored delayed torque control — not physical evidence',units:{time:'s',position:'rad',rate:'rad/s',command:'N·m',jointTorque:'N·m'},maxGap:.11,tieTolerance:1e-9,offsets:[-.2,-.1,0,.1,.2,.3,.4],states,torques}};
}
