import {EvolutionDomainError,predictEvolution} from './operator-synthesis.mjs';

import {affineCoefficients} from './affine-operator-columns.mjs';

const PI2=2*Math.PI;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const scale=(a,s)=>[a[0]*s,a[1]*s];
const product=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const phase=t=>[Math.cos(t),Math.sin(t)];

function exponential(x,y) {
  return scale(phase(y),Math.exp(x));
}

// Integral from 0 to 1 of exp((x+i*y)t). The real numerator form
// avoids subtracting 1 from cos(y) when y is small.
function exponentialIntegral(x,y) {
  if(x===0&&y===0)return [1,0];
  const mag=Math.max(Math.abs(x),Math.abs(y));
  const real=Math.expm1(x)*Math.cos(y)-2*Math.sin(y/2)**2;
  const imag=Math.exp(x)*Math.sin(y);
  const a=x/mag,b=y/mag,den=a*a+b*b;
  return [((real/mag)*a+(imag/mag)*b)/den,((imag/mag)*a-(real/mag)*b)/den];
}

function coefficients(model,course) {
  if(model.kind!=='periodic') return null;
  const f=course.forcing;
  if(f.amplitude!==0&&f.startFrequency!==f.endFrequency) return null;
  const initial=course.initial,n=initial.length;
  predictEvolution(model,{field:initial[0],left:initial[n-1],right:initial[1],spacing:course.spacing,command:f.offset});
  const stationary=f.amplitude===0||f.startFrequency===0;
  const variables=stationary?['field','dx','dxx']:['field','dx','dxx','command'];
  const constants=stationary?{command:f.offset}:{};
  const sum=Array(variables.length+1).fill(0);
  for(const {tree,weight} of model.terms) {
    const row=affineCoefficients(tree,variables,constants);
    if(!row) return null;
    for(let i=0;i<sum.length;i++) sum[i]+=weight*row[i];
  }
  return {command:0,...Object.fromEntries([...variables,'one'].map((key,i)=>[key,sum[i]]))};
}

export function periodicLinearPlan(model,course) {
  const coeff=coefficients(model,course);
  if(coeff===null) return null;
  const {initial,spacing,forcing}=course,n=initial.length;
  const flat=initial.every(v=>v===initial[0]),modes=[];
  const omega=forcing.amplitude===0?0:PI2*forcing.startFrequency;
  for(let k=0;k<n;k++) {
    const dc=k===0?coeff.one+coeff.command*forcing.offset:0;
    const forced=k===forcing.spatialMode || k===n-forcing.spatialMode;
    const sine=forced&&omega!==0?coeff.command*forcing.amplitude*(k===0||2*k===n?1:.5):0;
    if(flat && k!==0 && sine===0) continue;
    const angle=PI2*k/n, inverse=initial.map((_,j)=>phase(angle*j));
    let z=[0,0];
    if(flat) z=[k===0?initial[0]:0,0];
    else for(let j=0;j<n;j++) {
      z[0]+=(initial[j]/n)*inverse[j][0];
      z[1]-=(initial[j]/n)*inverse[j][1];
    }
    if(z[0]===0&&z[1]===0&&dc===0&&sine===0) continue;
    const a=coeff.field-4*coeff.dxx*(Math.sin(angle/2)/spacing)**2;
    const b=k===0||2*k===n?0:coeff.dx*Math.sin(angle)/spacing;
    modes.push({a,b,z,dc,sine,inverse});
  }
  return {
    // Charge a complete forward projection even when the field is flat.
    work(substeps){return n*n+course.steps*(n+substeps)*modes.length;},
    run(substeps) {
      const h=course.step/substeps,wh=omega*h;
      const steps=modes.map(({a,b,z,dc,sine,inverse})=>{
        const x=a*h,y=b*h;
        if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(y)>2**30)
          throw new EvolutionDomainError('periodic_transition_budget');
        const exp=exponential(x,y);
        if(!exp.every(Number.isFinite))throw new EvolutionDomainError('nonfinite_trajectory');
        const bias=dc===0?[0,0]:scale(exponentialIntegral(x,y),h*dc);
        let cosDrive=[0,0],sinDrive=[0,0];
        if(sine!==0) {
          const plus=product(phase(wh),exponentialIntegral(x,y-wh));
          const minus=product(phase(-wh),exponentialIntegral(x,y+wh));
          cosDrive=scale(add(plus,minus),h*sine/2);
          sinDrive=[(plus[1]-minus[1])*h*sine/2,(minus[0]-plus[0])*h*sine/2];
        }
        return {exp,bias,cosDrive,sinDrive,z:[...z],inverse};
      });
      const states=[[...initial]];
      for(let i=0;i<course.steps;i++) {
        for(let j=0;j<substeps;j++) {
          const [cos,sin]=phase((i*substeps+j)*wh);
          for(const m of steps) m.z=add(add(product(m.exp,m.z),m.bias),add(scale(m.cosDrive,sin),scale(m.sinDrive,cos)));
        }
        const next=Array(n).fill(0);
        for(const m of steps) for(let j=0;j<n;j++) {
          next[j]+=m.z[0]*m.inverse[j][0]-m.z[1]*m.inverse[j][1];
        }
        if(!next.every(Number.isFinite))throw new EvolutionDomainError('nonfinite_trajectory');
        states.push(next);
      }
      return states;
    }
  };
}
