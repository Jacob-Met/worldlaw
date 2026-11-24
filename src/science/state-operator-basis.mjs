const need=(ok,message)=>{if(!ok)throw new RangeError(message);};
export function periodicStencil(values,index,spacing,order){
  const n=values.length,j=index;
  need(Number.isInteger(n)&&n>=6&&Number.isInteger(j)&&j>=0&&j<n&&Number.isFinite(spacing)&&spacing>0&&Number.isInteger(order)&&order>=0&&order<=4,'Invalid periodic stencil');
  const at=k=>values[(j+k+n)%n],h=spacing,u=at(0);
  if(order===0)return u;
  const l=at(-1),r=at(1);
  if(order===1)return (r-l)/(2*h);
  if(order===2)return (l-2*u+r)/(h*h);
  const ll=at(-2),rr=at(2);
  return order===3?(rr-2*r+2*l-ll)/(2*h**3):(rr-4*r+6*u-4*l+ll)/(h**4);
}
export const SPATIAL_OPERATOR_ORDERS=Object.freeze({gradient:1,laplacian:2,thirdDerivative:3,biharmonic:4});
/** Response-independent finite basis. Constants inside nonlinear atoms are
 * declared public grammar choices, not coefficients fitted from a law label.
 * All outer coefficients and supports are free in the STLSQ baseline.
 */
export function extendedStateBasis(kind){
  need(['oscillator','kinetic','periodic'].includes(kind),'Invalid extended basis geometry');
  const bank=new Map(),add=t=>bank.set(JSON.stringify(t),t),mul=(a,b)=>['mul',a,b],sq=x=>mul(x,x),cube=x=>mul(sq(x),x);
  const atoms=kind==='oscillator'?['position','rate','command']:kind==='kinetic'?['state0','state1']:['field','command'];
  add('one');
  function products(parts,start,left){
    if(!left){add(parts.reduce((a,b)=>a?mul(a,b):b,null));return;}
    for(let j=start;j<atoms.length;j++)products([...parts,atoms[j]],j,left-1);
  }
  for(let degree=1;degree<=3;degree++)products([],0,degree);
  if(kind==='periodic'){
    const a='field',fluxes=[a,sq(a),cube(a)];
    for(const op of ['sin','cos','tanh']){const t=[op,a];add(t);fluxes.push(t);}
    for(const flux of fluxes)for(const op of ['gradient','laplacian'])add([op,flux]);
    add(['thirdDerivative',a]);add(['biharmonic',a]);
  }else{
    const [q,v]=atoms;
    for(const op of ['sin','cos','tanh'])for(const a of [q,v])add([op,a]);
    add(mul(v,['abs',v]));add(['tanh',mul(4,v)]);
    add(['exp',mul(-1,q)]);add(['exp',mul(-2,q)]);
    add(mul(q,['sin',q]));
    for(const a of [q,v])add(['div',a,['add','one',sq(a)]]);
    if(kind==='oscillator')add(mul('command',['cos',q]));
    else{
      for(const u of ['command0','command1']){add(u);for(const a of [q,v])add(mul(a,u));}
      add(['div',mul(q,v),['add','one',['abs',q]]]);
      add(['div',sq(v),['add',.25,['abs',q]]]);
    }
  }
  need(bank.size<=256,'Extended basis exceeds feature budget');
  return [...bank.values()];
}
