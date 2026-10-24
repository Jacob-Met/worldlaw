/** Constant 2×2 inertia declared by the investigator, never inferred from torque samples. */
import {finite,pair,requireThat} from './science.mjs';

export const MAX_INERTIA_CONDITION = 1e8;
export const MIN_INERTIA_EIGENVALUE = 1e-9;
/** Cholesky coordinate/force maps and bounded positive-definite admission. */
export function readSymmetricInertia(diagonal,cross) {
  const [a,b]=pair(diagonal,'inertia',1e6);finite(cross,'inertiaCross',1e6);
  requireThat(a>=MIN_INERTIA_EIGENVALUE&&b>=MIN_INERTIA_EIGENVALUE,
    'Each inertia diagonal must be at least 1e-9 kg·m².');
  const scale=[Math.sqrt(a),Math.sqrt(b)],rho=cross/scale[0]/scale[1];
  requireThat(Math.abs(rho)<1,'The declared symmetric inertia must be positive definite.','unsupported_inertia');
  // Products of (1−|rho|)(1+|rho|) avoid subtracting separately squared inertias.
  const margin=(1-Math.abs(rho))*(1+Math.abs(rho)),largest=Math.max(a,b);
  const an=a/largest,bn=b/largest,cn=cross/largest,det=an*bn*margin;
  const largestEigenvalue=(an+bn+Math.hypot(an-bn,2*cn))/2*largest;
  const minimumEigenvalue=det/((an+bn+Math.hypot(an-bn,2*cn))/2)*largest;
  const conditionInfinity=Math.max(an+Math.abs(cn),bn+Math.abs(cn))**2/det;
  requireThat(Number.isFinite(conditionInfinity)&&conditionInfinity<=MAX_INERTIA_CONDITION&&minimumEigenvalue>=MIN_INERTIA_EIGENVALUE,
    'The declared inertia is outside numerical support: minimum eigenvalue must be at least 1e-9 kg·m² and infinity-norm condition at most 1e8.','unsupported_inertia');
  const t=Math.sqrt(margin),s0=scale[0],s1=scale[1];
  return {matrix:[[a,cross],[cross,b]],scale,rho,margin,minimumEigenvalue,largestEigenvalue,conditionInfinity,
    toMass:[[s0,rho*s1],[0,t*s1]],
    fromMass:[[1/s0,-rho/(s0*t)],[0,1/(s1*t)]],
    forceToMass:[[1/s0,0],[-rho/(s0*t),1/(s1*t)]],
    qualification:'Declared constant symmetric inertia; positive definiteness and conditioning are numerical admission, not physical calibration.'};
}
export function solveSymmetricInertia(factor,torque) {
  const [s0,s1]=factor.scale,x=torque[0]/s0,y=torque[1]/s1;
  return [(x-factor.rho*y)/factor.margin/s0,(y-factor.rho*x)/factor.margin/s1];
}
