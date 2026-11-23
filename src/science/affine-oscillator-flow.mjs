// The augmented position, velocity and constant coordinate evolve linearly.
// Symbolic affine expressions use the same flow across equivalent source trees.
import {EvolutionDomainError, predictEvolution} from './operator-synthesis.mjs';

const identity = () => [1,0,0,0,1,0,0,0,1];

function multiply(a,b) {
  const c = new Array(9);
  for (let i=0;i<3;i++) for(let j=0;j<3;j++)
    c[3*i+j]=a[3*i]*b[j]+a[3*i+1]*b[3+j]+a[3*i+2]*b[6+j];
  return c;
}

function transition(a,b,h) {
  // Use interval time t/h and velocity h*v. The last column is a unit
  // acceleration response, so the transition budget is invariant to time
  // units and independent of the constant external drive's amplitude.
  const spring=(a*h)*h, damping=b*h;
  const matrix=[0,1,0,spring,damping,1,0,0,0];
  const norm=Math.max(Math.abs(spring),1+Math.abs(damping));
  // With ||B||_1 <= 1/2, the degree-18 Taylor truncation of exp(B) has
  // norm <= exp(1/2) (1/2)^19/19! before floating-point roundoff.
  const squares=norm<=.5?0:Math.ceil(Math.log2(norm)+1);
  if(!Number.isFinite(squares)||squares>32) throw new EvolutionDomainError('affine_transition_budget');
  const reduced=matrix.map(v=>v*2**(-squares));
  let result=identity(),term=identity();
  for(let k=1;k<=18;k++) {
    term=multiply(term,reduced).map(v=>v/k);
    result=result.map((v,j)=>v+term[j]);
  }
  for(let j=0;j<squares;j++) result=multiply(result,result);
  if(!result.every(Number.isFinite)) throw new EvolutionDomainError('nonfinite_trajectory');
  return result;
}

const fixedUnary = {sin: Math.sin, cos: Math.cos, abs: Math.abs, tanh: Math.tanh};

function coefficients(tree, command) {
  if (tree === 'position') return [1, 0, 0];
  if (tree === 'rate') return [0, 1, 0];
  if (tree === 'one' || tree === 'command') return [0, 0, tree === 'one' ? 1 : command];
  const [operator, left, right] = tree;
  const x = coefficients(left, command);
  if (!x) return null;
  const constant = row => row[0] === 0 && row[1] === 0;
  let result;
  if (right === undefined) {
    if (!constant(x)) return null;
    result = [0, 0, fixedUnary[operator](x[2])];
  } else {
    const y = coefficients(right, command);
    if (!y) return null;
    if (operator === 'add') result = x.map((v, i) => v + y[i]);
    else if (operator === 'mul' && constant(x)) result = y.map(v => x[2] * v);
    else if (operator === 'mul' && constant(y)) result = x.map(v => v * y[2]);
    else if (operator === 'div' && constant(y) && y[2] !== 0) result = x.map(v => v / y[2]);
    else return null;
  }
  return result.every(Number.isFinite) ? result : null;
}

export function constantOscillatorFlow(model,course,substeps=1) {
  if(model.kind!=='oscillator' || course.forcing.amplitude!==0) return null;
  const u=course.forcing.offset;
  predictEvolution(model,{position:course.initial[0],rate:course.initial[1],command:u});
  let a=0,b=0,c=0;
  for(const {tree,weight} of model.terms) {
    const row = coefficients(tree, u);
    if (!row) return null;
    a += weight * row[0];
    b += weight * row[1];
    c += weight * row[2];
  }
  const h=course.step/substeps;
  const m=transition(a,b,h);
  const velocityFromPosition=(a*h)*m[1];
  const velocityFromDrive=(c*h)*m[5];
  const positionFromDrive=((c*h)*m[2])*h;
  const states=[[...course.initial]];
  let [q,v]=course.initial;
  for(let i=0;i<course.steps;i++) {
    for(let j=0;j<substeps;j++) {
      const nextPosition=m[0]*q+(m[1]*v)*h+positionFromDrive;
      const nextVelocity=velocityFromPosition*q+m[4]*v+velocityFromDrive;
      if(!Number.isFinite(nextPosition)||!Number.isFinite(nextVelocity))
        throw new EvolutionDomainError('nonfinite_trajectory');
      q=nextPosition;v=nextVelocity;
    }
    states.push([q,v]);
  }
  return states;
}
