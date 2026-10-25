// Authored synthetic control. Ratios describe the generator's declared noise;
// the product does not estimate them. Held-out inputs and outcomes stay separate.
export function authoredMixedPrecision(seed=1337) {
  let randomState=seed>>>0;
  const uniform=()=>((randomState=(Math.imul(1664525,randomState)+1013904223)>>>0)+.5)/4294967296;
  const normal=()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
  const point=(i,phase)=>({command:.8*Math.sin(i*1.379+phase),position:2.2*Math.sin(i*.793+.4+phase),rate:1.8*Math.cos(i*2.417+phase)});
  const truth=p=>1.6*p.command-.7*p.position-.23*p.rate*Math.abs(p.rate);
  const observations=Array.from({length:121},(_,i)=>{const p=point(i,0),sigma=i<25?.01:2;return {...p,jointTorque:truth(p)+sigma*normal(),torqueNoiseRatio:sigma/.01};});
  const heldOut=Array.from({length:83},(_,i)=>{const p=point(i,.721);return {...p,jointTorque:truth(p)};});
  return {schema:'worldlaw.observations/v3',source:{label:'Authored mixed-precision torque course',kind:'authored-synthetic-control',metadata:{generator:'LCG Box-Muller, known scalar law',seed,referenceNoise:.01,trainingNoise:[{rows:25,sigma:.01,ratio:1},{rows:96,sigma:2,ratio:200}],heldOut:'83 separate clean authored states; not physical measurements'}},observations,heldOut};
}
