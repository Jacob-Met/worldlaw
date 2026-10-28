/** Exact original-standard equality for a proposed binary64 latent pair.
 * This verifies supplied source arithmetic, not QR error or physical accuracy. */
import{rational as q,add,sub,mul,div,cmp}from'../unknown-lab/chronos-exact-halfplanes.mjs';
export function verifyCalibrationEquality(report,standard,components){
 if(standard.absoluteError!==0||!Array.isArray(components)||components.length!==2||components.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1))return false;
 const [a,b]=report.standards,gap=sub(q(b.reportedTorque),q(a.reportedTorque)),v=div(sub(q(standard.reportedTorque),q(a.reportedTorque)),gap),u=sub(q(1),v);
 const correction=(s,z)=>add(sub(q(s.referenceTorque),q(s.reportedTorque)),mul(q(s.absoluteError),q(z)));
 const corrected=add(q(standard.reportedTorque),add(mul(u,correction(a,components[0])),mul(v,correction(b,components[1]))));
 return cmp(corrected,q(standard.referenceTorque))===0;
}
