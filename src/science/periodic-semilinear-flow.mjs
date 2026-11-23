import {affineCoefficients} from './affine-operator-columns.mjs';
import {predictEvolution,EvolutionDomainError} from './operator-synthesis.mjs';

function kernel(n,spacing,field,dx,dxx,time) {
  const samples=Array(n).fill(0);
  for(let k=0;k<n;k++) {
    const angle=2*Math.PI*k/n;
    const re=(field-4*dxx*(Math.sin(angle/2)/spacing)**2)*time;
    const im=k===0||2*k===n?0:dx*Math.sin(angle)/spacing*time;
    if (!Number.isFinite(re)||!Number.isFinite(im)||Math.abs(im)>2**30)
      throw new EvolutionDomainError('periodic_transition_budget');
    const amplitude=Math.exp(re)/n;
    for(let l=0;l<n;l++) samples[l]+=amplitude*Math.cos(angle*l+im);
  }
  if(!samples.every(Number.isFinite))throw new EvolutionDomainError('nonfinite_trajectory');
  return samples;
}
function convolve(weights,x) {
  return x.map((_,j)=>weights.reduce((s,v,l)=>s+v*x[(j-l+x.length)%x.length],0));
}
const advance=(x,d,h)=>x.map((v,i)=>v+h*d[i]);

// Lawson RK4 handles the homogeneous part exactly through each stage. No
// inverse diffusion or backward-time matrix exponential is needed.
export function periodicSemilinearPlan(model,course,commandAt) {
  if(model.kind!=='periodic') return null;
  const n=course.initial.length,initial=course.initial;
  predictEvolution(model,{field:initial[0],left:initial[n-1],right:initial[1],spacing:course.spacing,command:course.forcing.offset});
  const variables=['field','dx','dxx','command'];
  const coeff=[0,0,0,0,0], remaining=[];
  function split(tree,weight) {
    if(Array.isArray(tree)&&tree[0]==='add') {
      split(tree[1],weight);split(tree[2],weight);return;
    }
    const row=affineCoefficients(tree,variables);
    if(!row) {remaining.push({tree,weight});return;}
    for(let j=0;j<5;j++)coeff[j]+=row[j]*weight;
  }
  for(const term of model.terms)split(term.tree,term.weight);
  if(coeff[2]<=0||!coeff.every(Number.isFinite))return null;
  const groups=[];
  for(let i=0;i<remaining.length;i+=4)groups.push({...model,terms:remaining.slice(i,i+4)});
  const nonlinear=(x,t)=>x.map((field,j)=>{
    const command=commandAt(course,t,j,n);
    const row={field,left:x[(j+n-1)%n],right:x[(j+1)%n],spacing:course.spacing,command};
    return groups.reduce((v,model)=>v+predictEvolution(model,row),coeff[4]+coeff[3]*command);
  });
  return {
    minimumSubsteps:Math.max(1,Math.ceil(course.step*(Math.abs(coeff[0])+Math.abs(coeff[1])/course.spacing+4*coeff[2]/course.spacing**2))),
    work(substeps){return 2*n*n+course.steps*substeps*(6*n*n+4*n);},
    run(substeps) {
      const h=course.step/substeps;
      const half=kernel(n,course.spacing,coeff[0],coeff[1],coeff[2],h/2),whole=kernel(n,course.spacing,coeff[0],coeff[1],coeff[2],h);
      const states=[[...course.initial]];
      let x=states[0];
      for(let i=0;i<course.steps;i++) {
        for(let j=0;j<substeps;j++) {
          const t=(i+j/substeps)*course.step;
          const eh=convolve(half,x),ef=convolve(whole,x),k1=nonlinear(x,t);
          const ha=convolve(half,k1),fa=convolve(whole,k1);
          const k2=nonlinear(advance(eh,ha,h/2),t+h/2);
          const k3=nonlinear(advance(eh,k2,h/2),t+h/2);
          const hc=convolve(half,k3);
          const k4=nonlinear(advance(ef,hc,h),t+h);
          const hb=convolve(half,k2);
          x=ef.map((v,l)=>v+h*(fa[l]+2*hb[l]+2*hc[l]+k4[l])/6);
          if(!x.every(Number.isFinite))throw new EvolutionDomainError('nonfinite_trajectory');
        }
        states.push(x);
      }
      return states;
    }
  };
}
