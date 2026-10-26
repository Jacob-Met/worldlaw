/** Shared admission for the offered constant symmetric viscous-loss family. */
import {requireThat} from './science.mjs';

export function readSymmetricDamping(d0,d1,cross){
 requireThat([d0,d1,cross].every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6)&&d0>=0&&d1>=0,
  'Symmetric damping is outside the finite nonnegative-diagonal family.');
 // The first sufficient inequality preserves exact equal-diagonal rank-one
 // boundaries such as [.8,.8,.8], whose rounded square-root product is below .8.
 requireThat(Math.abs(cross)<=Math.min(d0,d1)||Math.abs(cross)<=Math.sqrt(d0)*Math.sqrt(d1),
  'Symmetric damping is not positive semidefinite.');
 const scale=Math.max(d0,d1,Math.abs(cross));
 let minimumEigenvalue=0,maximumEigenvalue=0;
 if(scale){
  const a=d0/scale,b=d1/scale,c=cross/scale;
  maximumEigenvalue=(a+b+Math.hypot(a-b,2*c))/2*scale;
  minimumEigenvalue=(a*b-c*c)/(maximumEigenvalue/scale)*scale;
 }
 return {matrix:[[d0,cross],[cross,d1]],minimumEigenvalue,maximumEigenvalue,
  meaning:'Conditional symmetric viscous-loss matrix; numerical PSD admission does not establish physical passivity.'};
}
