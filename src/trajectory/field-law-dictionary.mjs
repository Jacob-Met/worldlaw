/** Finite two-coefficient dynamical-law dictionary and forward integrator.
 * The observation layout, command and step are public. A fitted model supplies
 * its own structure and coefficients for each forward prediction.
 */
export const laws = Object.freeze({
  oscillator: ['pendulum','duffing','van-der-pol','rayleigh','quartic-spring','double-well',
    'morse','toda','quadratic-drag','dry-friction'],
  kinetic: ['lotka-volterra','brusselator','fitzhugh-nagumo','competition','holling-tanner'],
  periodic: ['burgers','kdv','modified-kdv','allen-cahn','fisher-kpp','porous-medium','cahn-hilliard'],
});
export const DT=.025, N=128, GRID=16;
const dx=2*Math.PI/GRID;
export function layoutFor(id) {
  if (id==='lorenz-hidden-z') return 'kinetic';
  if (id==='delay-feedback') return 'oscillator';
  return Object.keys(laws).find(k=>laws[k].includes(id));
}

function spring(id,q,v) {
  switch(id) {
    case 'pendulum': return [-Math.sin(q),-.35*v];
    case 'duffing': return [-q-.5*q**3,-.35*v];
    case 'van-der-pol': return [-q,.65*(1-q*q)*v];
    case 'rayleigh': return [-q,.65*(1-v*v)*v];
    case 'quartic-spring': return [-(q**3),-.35*v];
    case 'double-well': return [q-q**3,-.35*v];
    case 'morse': return [-2*Math.exp(-q)*(1-Math.exp(-q)),-.35*v];
    case 'toda': return [Math.expm1(-q),-.35*v];
    case 'quadratic-drag': return [-q,-.35*Math.abs(v)*v];
    case 'dry-friction': return [-q,-.35*Math.tanh(4*v)];
    default: throw Error('unknown restoring force');
  }
}

export function components(id,y) {
  const q=y[0],v=y[1];
  if (laws.oscillator.includes(id)) {
    const [a,b]=spring(id,q,v);
    return [[v,0],[0,a],[0,b]];
  }
  if (laws.kinetic.includes(id)) {
    switch(id) {
      case 'lotka-volterra': return [[0,0],[q, -.65*v],[-q*v,.8*q*v]];
      case 'brusselator': return [[.9,0],[-2*q,1.1*q],[q*q*v,-q*q*v]];
      case 'fitzhugh-nagumo': return [[.35,.05],[q-q**3/3,.16*q],[-v,-.12*v]];
      case 'competition': return [[0,0],[q*(1-q),.6*v*(1-v)],[-.65*q*v,-.25*q*v]];
      case 'holling-tanner': return [[0,0],[q*(1-q/2),.25*v],
        [-q*v/(1+Math.abs(q)),-.12*v*v/(.25+Math.abs(q))]];
    }
  }
  if (!laws.periodic.includes(id) || y.length!==GRID) throw Error('unknown field or grid');
  const a=[],b=[],zero=Array(GRID).fill(0);
  for (let i=0;i<GRID;i++) {
    const u=y[i], l=y[(i+GRID-1)%GRID],r=y[(i+1)%GRID];
    const ll=y[(i+GRID-2)%GRID],rr=y[(i+2)%GRID];
    const lap=(r-2*u+l)/dx**2;
    const third=(rr-2*r+2*l-ll)/(2*dx**3);
    switch(id) {
      case 'burgers': a.push(-(r*r-l*l)/(4*dx));b.push(.12*lap);break;
      case 'kdv': a.push(-(r*r-l*l)/(4*dx));b.push(-.06*third);break;
      case 'modified-kdv': a.push(-(r**3-l**3)/(6*dx));b.push(-.06*third);break;
      case 'allen-cahn': a.push(.65*(u-u**3));b.push(.12*lap);break;
      case 'fisher-kpp': a.push(.65*u*(1-u));b.push(.12*lap);break;
      case 'porous-medium': a.push(.06*(r**3-2*u**3+l**3)/dx**2);b.push(-.2*u);break;
      case 'cahn-hilliard':
        a.push(.035*(r**3-r-2*(u**3-u)+l**3-l)/dx**2);
        b.push(-.004*(rr-4*r+6*u-4*l+ll)/dx**4);break;
    }
  }
  return [zero,a,b];
}

export function command(layout,id,t) {
  const n=layout==='periodic'?GRID:2;
  if (id<0) return Array(n).fill(0);
  const temporal=(id%4)+1, sign=id<4?1:-1;
  const value=.48*sign*Math.sin(2*Math.PI*temporal*t/(DT*N));
  if (layout==='oscillator') return [0,value];
  if (layout==='kinetic') return [value,0];
  const mode=1+(id%3);
  return Array.from({length:GRID},(_,i)=>value*Math.SQRT2*Math.sin(mode*i*dx+.3));
}

function derivative(id,coef,y,u) {
  const [drift,a,b]=components(id,y);
  return drift.map((d,i)=>d+coef[0]*a[i]+coef[1]*b[i]+u[i]);
}
const plus=(y,k,h)=>y.map((v,i)=>v+h*k[i]);
export function rollout(id,coef,initial,drive,{steps=N,start=0}={}) {
  if(!Number.isInteger(steps)||steps<0||!Number.isInteger(start)||start<0||start+steps>N) throw new RangeError('Invalid rollout interval');
  const layout=layoutFor(id), states=[initial.slice()];
  let y=initial.slice();
  for (let t=start;t<start+steps;t++) {
    const k1=derivative(id,coef,y,command(layout,drive,t*DT));
    const mid=command(layout,drive,(t+.5)*DT);
    const k2=derivative(id,coef,plus(y,k1,.5*DT),mid);
    const k3=derivative(id,coef,plus(y,k2,.5*DT),mid);
    const k4=derivative(id,coef,plus(y,k3,DT),command(layout,drive,(t+1)*DT));
    y=y.map((v,i)=>v+DT*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
    if (y.some(v=>!Number.isFinite(v)||Math.abs(v)>80)) return null;
    states.push(y);
  }
  return states;
}
