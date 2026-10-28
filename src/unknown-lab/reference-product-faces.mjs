// Shared complete component-product geometry. No source admission or fitting here.
const EPS=Number.EPSILON,MAX_WORK=250000;
const finite=x=>typeof x==='number'&&Number.isFinite(x),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),fail=m=>{throw Error(m);};
class Unresolved extends Error{}
const numeric=m=>{throw new Unresolved(m);};
// Exact dyadic rank predicates ONLY: optimization, intersections and widths remain
// binary64 screening. A rounded zero must not erase a genuinely nonzero pivot.
const buffer=new DataView(new ArrayBuffer(8));
function dyadic(x){if(!finite(x))numeric('Nonfinite rank predicate.');buffer.setFloat64(0,x);const bits=buffer.getBigUint64(0),s=bits>>63n?-1n:1n,e=Number((bits>>52n)&2047n),m=bits&((1n<<52n)-1n);return [s*(e?m+(1n<<52n):m),e?e-1075:-1074];}
function add([a,e],[b,f]){const k=Math.min(e,f);return [(a<<BigInt(e-k))+(b<<BigInt(f-k)),k];}
const mul=([a,e],[b,f])=>[a*b,e+f],neg=([a,e])=>[-a,e],sub=(a,b)=>add(a,neg(b));
const exactDot=(a,b)=>a.reduce((s,x,i)=>add(s,mul(dyadic(x),dyadic(b[i]))),[0n,0]);
function scalarDot(a,b){const value=dot(a,b),scale=a.reduce((s,x,i)=>s+Math.abs(x*b[i]),0);if(!finite(value)||!finite(scale))numeric('Nonfinite linear form.');return {value,scale,exact:exactDot(a,b)};}
function direction(a,b){return b.map((x,i)=>x-a[i]);}
function hull(points){
 const p=[...new Map(points.map(x=>[JSON.stringify(x),x])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(p.length<3)return p;
 function turn(a,b,c){const u=direction(a,b),v=direction(a,c),x=u[0]*v[1],y=u[1]*v[0],z=x-y;const ex=sub(mul(dyadic(u[0]),dyadic(v[1])),mul(dyadic(u[1]),dyadic(v[0])));
  if(ex[0]===0n)return 0;if(!finite(z)||Math.abs(z)<=64*EPS*(Math.abs(x)+Math.abs(y)))numeric('Original component orientation is numerically unresolved.');return z;}
 const half=xs=>{const h=[];for(const x of xs){while(h.length>1&&turn(h.at(-2),h.at(-1),x)<=0)h.pop();h.push(x);}return h;};return half(p).slice(0,-1).concat(half([...p].reverse()).slice(0,-1));
}
const edges=p=>p.length===1?[]:p.length===2?[[p[0],p[1]]]:p.map((a,i)=>[a,p[(i+1)%p.length]]);
function constraints(p){
 if(p.length===1){const[x,y]=p[0];return [[[1,0],x],[[-1,0],-x],[[0,1],y],[[0,-1],-y]];}
 if(p.length===2){const[a,b]=p,d=direction(a,b),n=[d[1],-d[0]];return [[n,dot(n,a)],[n.map(x=>-x),-dot(n,a)],[d,dot(d,b)],[d.map(x=>-x),-dot(d,a)]];}
 return edges(p).map(([a,b])=>{const n=[b[1]-a[1],a[0]-b[0]];return [n,dot(n,a)];});
}
function contains(cs,x){return cs.every(([n,b])=>{const value=dot(n,x),guard=1e-10*(1+Math.abs(b)+n.reduce((s,a,i)=>s+Math.abs(a*x[i]),0));if(!finite(value)||!finite(guard))numeric('Nonfinite feasibility check.');return value<=b+guard;});}
function solveFace(cuts,origin,u,v){
 const [[n,c],[m,d]]=cuts,a=scalarDot(n,u),b=scalarDot(n,v),cc=scalarDot(m,u),dd=scalarDot(m,v),ex=sub(mul(a.exact,dd.exact),mul(b.exact,cc.exact));
 if(ex[0]===0n)return null; // Exactly dependent restrictions: lower faces cover endpoints.
 const det=a.value*dd.value-b.value*cc.value,scale=a.scale*dd.scale+b.scale*cc.scale;
 if(!finite(det)||!finite(scale)||Math.abs(det)<=128*EPS*scale)numeric('Two-face intersection is numerically unresolved; complete offer withheld.');
 const e=c-dot(n,origin),f=d-dot(m,origin),t=(e*dd.value-b.value*f)/det,s=(a.value*f-e*cc.value)/det;if(!finite(t)||!finite(s))numeric('Nonfinite face intersection.');return [t,s];
}
const guardParameter=1e-10,inUnit=x=>x>=-guardParameter&&x<=1+guardParameter,unit=x=>Math.max(0,Math.min(1,x));
export function screenReferenceProducts(parts,signs,us,vs,rho,epsilon,{workLimit=MAX_WORK,modelIds=parts.map((_,i)=>String(i))}={}){
 if(!Array.isArray(parts)||parts.length<1||parts.length>26||parts.some(p=>!Array.isArray(p)||!p.length||p.length>64||p.some(x=>!Array.isArray(x)||x.length!==2||!x.every(finite)||x.some(y=>Math.abs(y)>100))))fail('Use at most 26 original bounded components with at most 64 vertices each.');
 if(!Array.isArray(signs)||signs.length!==parts.length||signs.some((s,i)=>![1,-1].includes(s)||parts[i].some(x=>s*x[0]<0)))fail('Preserve every original gain-sign component.');
 if(![us,vs].every(a=>Array.isArray(a)&&a.length===parts.length&&a.every(x=>Array.isArray(x)&&x.length===2&&x.every(finite)))||us.some(x=>x[0]!==us[0][0])||vs.some(x=>x[0]!==vs[0][0])||!Array.isArray(modelIds)||modelIds.length!==parts.length||modelIds.some(x=>typeof x!=='string'||!x||x.length>80)||!finite(rho)||rho<0||!finite(epsilon)||epsilon<0||!Number.isSafeInteger(workLimit)||workLimit<1||workLimit>MAX_WORK)fail('Finite projections, explicit nonnegative half-widths and bounded work required.');
 try{
  const polygons=parts.map(hull),es=polygons.map(edges);let reserved=0;
  for(let i=0;i<parts.length;i++)for(let j=0;j<parts.length;j++)reserved+=polygons[i].length*polygons[j].length+2*(es[i].length*polygons[j].length+polygons[i].length*es[j].length)+es[i].length*es[j].length+(polygons[i].length>2?polygons[j].length:0)+(polygons[j].length>2?polygons[i].length:0);
  if(reserved>workLimit)numeric('Complete product-face work exceeds the declared work bound; no partial result.');
  let best=null,checked=0;const pairs=[];
  for(let i=0;i<parts.length;i++)for(let j=0;j<parts.length;j++){
   const pi=polygons[i],pj=polygons[j],si=signs[i],sj=signs[j],[r,fi]=us[i],fj=us[j][1],cuts=[[[r-rho*si,fi,-r-rho*sj,-fj],2*epsilon],[[-r-rho*si,-fi,r-rho*sj,fj],2*epsilon]],cs=constraints(pi).map(([a,b])=>[[...a,0,0],b]).concat(constraints(pj).map(([a,b])=>[[0,0,...a],b]),cuts);let local=null,feasible=0;
   const accept=x=>{checked++;if(!x.every(finite))numeric('Nonfinite candidate pair.');if(!contains(cs,x))return;feasible++;const value=Math.abs(dot(vs[i],x.slice(0,2))-dot(vs[j],x.slice(2)));if(!finite(value))numeric('Nonfinite target width.');if(!local||value>local.width)local={width:value,x,i,j};};
   for(const a of pi)for(const b of pj)accept([...a,...b]);
   const productEdges=[];for(const[a,b]of es[i])for(const q of pj)productEdges.push([[...a,...q],[...b,...q]]);for(const p of pi)for(const[a,b]of es[j])productEdges.push([[...p,...a],[...p,...b]]);
   for(const[a,b]of productEdges){const delta=direction(a,b);for(const[n,c]of cuts){const den=scalarDot(n,delta);if(den.exact[0]===0n)continue;if(Math.abs(den.value)<=64*EPS*den.scale)numeric('Edge intersection is numerically unresolved; complete offer withheld.');const t=(c-dot(n,a))/den.value;if(!finite(t))numeric('Nonfinite edge parameter.');if(inUnit(t))accept(a.map((x,k)=>x+unit(t)*delta[k]));}}
   const faces=[];for(const[a,b]of es[i])for(const[c,d]of es[j])faces.push([[...a,...c],[...direction(a,b),0,0],[0,0,...direction(c,d)],true]);
   if(pi.length>2)for(const q of pj)faces.push([[0,0,...q],[1,0,0,0],[0,1,0,0],false]);if(pj.length>2)for(const p of pi)faces.push([[...p,0,0],[0,0,1,0],[0,0,0,1],false]);
   for(const[o,a,b,square]of faces){const ts=solveFace(cuts,o,a,b);if(!ts)continue;let[t,s]=ts;if(square){if(!inUnit(t)||!inUnit(s))continue;t=unit(t);s=unit(s);}accept(o.map((x,k)=>x+t*a[k]+s*b[k]));}
   pairs.push({leftComponent:i,rightComponent:j,leftModel:modelIds[i],rightModel:modelIds[j],feasibleCandidates:feasible,maximum:local?.width??null});if(local&&(!best||local.width>best.width))best=local;
  }
  if(!best)numeric('No diagonal pair survived; complete refinement unresolved.');const left=best.x.slice(0,2),right=best.x.slice(2),values=parts.flatMap((p,i)=>p.map(x=>dot(vs[i],x))),baseline=Math.max(...values)-Math.min(...values),[r]=us[best.i],bands=[[left,best.i],[right,best.j]].map(([[g,A],k])=>[g*r+A*us[k][1]-Math.abs(g)*rho-epsilon,g*r+A*us[k][1]+Math.abs(g)*rho+epsilon]),lo=Math.max(...bands.map(x=>x[0])),hi=Math.min(...bands.map(x=>x[1])),y=(lo+hi)/2,guard=1e-9*(1+Math.max(Math.abs(y),baseline,...values.map(Math.abs)));
  if(!finite(guard)||lo>hi+guard||best.width>baseline+guard)numeric('Attaining pair failed overlap or baseline check.');
  const referenceWitnesses=[],residuals=[];for(const[[g,A],k]of[[left,best.i],[right,best.j]]){const f=us[k][1];let ref=r;if(g!==0){const projected=[g*(r-rho)+A*f,g*(r+rho)+A*f].sort((a,b)=>a-b),main=Math.max(projected[0],Math.min(projected[1],y));ref=(main-A*f)/g;if(!finite(ref)||ref<r-rho-guard||ref>r+rho+guard)numeric('Latent reference witness is numerically unresolved.');ref=Math.max(r-rho,Math.min(r+rho,ref));}const residual=Math.abs(g*ref+A*f-y);if(!finite(residual)||residual>epsilon+guard)numeric('Attaining explanation failed MAIN residual check.');referenceWitnesses.push(ref);residuals.push(residual);}
  if(!contains(constraints(polygons[best.i]),left)||!contains(constraints(polygons[best.j]),right))numeric('Attaining pair failed original component membership.');
  return {status:'computed',baselineWidth:baseline,worstRemainingWidth:best.width,screeningReduction:baseline-best.width,numericalGuard:guard,work:{reservedCandidateBound:reserved,checkedCandidates:checked,limit:workLimit},pairs,witness:{left,right,leftComponent:best.i,rightComponent:best.j,leftModel:modelIds[best.i],rightModel:modelIds[best.j],commonMainReading:y,referenceInterval:[r-rho,r+rho],referenceWitnesses,mainResiduals:residuals,targetValues:[dot(vs[best.i],left),dot(vs[best.j],right)]}};
 }catch(e){if(e instanceof Unresolved)return {status:'numerically-unresolved',reason:e.message};throw e;}
}

export function reserveReferenceProductWork(parts,signs,offerCount,{limit=MAX_WORK}={}){
 if(!Number.isSafeInteger(offerCount)||offerCount<1||offerCount>32||!Number.isSafeInteger(limit)||limit<1||limit>MAX_WORK)fail('Complete comparison needs 1–32 offers and a work bound at most 250000.');
 if(!Array.isArray(parts)||parts.length<1||parts.length>26||parts.some(p=>!Array.isArray(p)||!p.length||p.length>64||p.some(x=>!Array.isArray(x)||x.length!==2||!x.every(finite)||x.some(y=>Math.abs(y)>100))))fail('Use all bounded original components, at most 26 with 64 vertices each.');
 if(!Array.isArray(signs)||signs.length!==parts.length||signs.some((s,i)=>![1,-1].includes(s)||parts[i].some(x=>s*x[0]<0)))fail('Preserve original gain signs.');
 try{const polygons=parts.map(hull),es=polygons.map(edges);let perOffer=0;
 for(let i=0;i<parts.length;i++)for(let j=0;j<parts.length;j++)perOffer+=polygons[i].length*polygons[j].length+2*(es[i].length*polygons[j].length+polygons[i].length*es[j].length)+es[i].length*es[j].length+(polygons[i].length>2?polygons[j].length:0)+(polygons[j].length>2?polygons[i].length:0);
 const total=perOffer*offerCount;if(total>limit)fail('Complete retained-family comparison exceeds '+limit+' reserved product-face candidates; no offer was scored.');return {status:'reserved',perOffer,total,limit,offers:offerCount,components:parts.length};
 }catch(e){if(e instanceof Unresolved)return {status:'numerically-unresolved',reason:e.message,offers:offerCount,components:parts.length};throw e;}
}
