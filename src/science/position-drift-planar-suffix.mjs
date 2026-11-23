/** Conditional suffixes after a three-pulse prefix, using both measured contrasts. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational} from './persistent-position-drift-all-horizon.mjs';
import {parsePositionDriftRates} from './persistent-position-drift-planner.mjs';
import {SUFFIX_PLAN,normalizedForcing,differenceVertices,affine} from './position-drift-suffix-regions.mjs';
import {compare,midpoint,contains,section,trappedSections,unsafeThirdBands} from './persistent-four-pulse-geometry.mjs';
import {feedbackPrimitive,intersectFeedbackHalfspaces} from './exact-feedback-feasibility.mjs';

const {Q,Z,add,sub,mul,div,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const abs=x=>x.n<0n?neg(x):x;
const two=Q(2n);
const times=(n,x)=>mul(Q(BigInt(n)),x);
const need=(ok,msg)=>{if(!ok)throw Error('Planar suffix: '+msg);};
export const PLANAR_SUFFIX_REQUEST='worldlaw.position-drift-suffix-feedback-source/v4';

function hull(points){
  const ordered=[...new Map(points.map(p=>[p.map(fmt).join(','),p])).values()]
    .sort((a,b)=>compare(a[0],b[0])||compare(a[1],b[1]));
  if(ordered.length<3)return ordered;
  function half(ps){
    const chain=[];
    for(const p of ps){
      while(chain.length>=2){
        const a=chain.at(-2),b=chain.at(-1);
        const turn=sub(mul(sub(b[0],a[0]),sub(p[1],a[1])),mul(sub(b[1],a[1]),sub(p[0],a[0])));
        if(turn.n>0n)break;
        chain.pop();
      }
      chain.push(p);
    }
    chain.pop();return chain;
  }
  return [...half(ordered),...half(ordered.slice().reverse())];
}

function projectPlane(left,right,error){
  const centers=[2,3].map(t=>midpoint(left[t],right[t])),points=[];
  differenceVertices(left,right,error,3,(d0,d1,difference)=>{
    const radii=[d0,d1,difference(2),difference(3)].map(v=>sub(error,div(abs(v),two)));
    for(let mask=0;mask<16;mask++){
      const [a,b,e,f]=radii.map((v,i)=>mask>>i&1?v:neg(v));
      points.push([add(centers[0],add(affine(a,b,2),e)),add(centers[1],add(affine(a,b,3),f))]);
    }
  });
  return hull(points);
}

function physicalBranch(cat,action,pair,readings){
  const force=[pair.i,pair.j].map(law=>{
    const out=[Z()];for(const u of action)out.push(add(out.at(-1),cat.rates[law][u]));return out;
  });
  // Reconstruct in original physical coordinates: pA,vA,pB,vB.
  const rows=[];
  for(let t=0;t<action.length+1;t++)for(const sign of [-1n,1n]){
    if(t<readings.length){
      for(let k=0;k<2;k++){
        const a=[0n,0n,0n,0n];a[2*k]=sign;a[2*k+1]=sign*BigInt(t);
        rows.push(feedbackPrimitive(a,add(cat.error,mul(Q(sign),sub(readings[t],force[k][t])))));
      }
    }else{
      const slope=sign*BigInt(t),a=[sign,slope,-sign,-slope];
      rows.push(feedbackPrimitive(a,sub(times(2,cat.error),mul(Q(sign),sub(force[0][t],force[1][t])))));
    }
  }
  const point=intersectFeedbackHalfspaces(rows,4,()=>{}).point;
  need(point,'a reported polygon collision has no physical initial states');
  const worlds=[pair.i,pair.j].map((law,k)=>({law:cat.ids[law],start:point.slice(2*k,2*k+2).map(fmt),
    values:force[k].map((f,t)=>add(f,add(point[2*k],times(t,point[2*k+1]))))}));
  const ys=[...readings,...worlds[0].values.slice(4).map((v,i)=>midpoint(v,worlds[1].values[i+4]))];
  for(const w of worlds)need(w.values.every((v,t)=>compare(abs(sub(v,ys[t])),cat.error)<=0),'physical replay failed');
  return {readings:ys.map(fmt),worlds:worlds.map(({law,start})=>({law,start}))};
}

export function planPlanarSuffix(request){
  need(request?.schema===PLANAR_SUFFIX_REQUEST&&Object.keys(request).sort().join(',')==='catalog,prefix,schema,suffixes',
    'supply a catalog, a three-command prefix and a suffix menu');
  const source=structuredClone(request.catalog),cat=parsePositionDriftRates(source,rational);
  const prefix=structuredClone(request.prefix),suffixes=structuredClone(request.suffixes);
  const valid=w=>Array.isArray(w)&&w.every(u=>cat.commands.includes(u));
  need(cat.ids.length<=4&&valid(prefix)&&prefix.length===3&&Array.isArray(suffixes)&&suffixes.length>0&&suffixes.length<=4&&
    suffixes.every(s=>valid(s)&&s.length===suffixes[0].length&&s.length>=1&&s.length<=6),
    'use three fixed pulses, up to four laws and one to four equal-length suffixes of at most six pulses');
  const actions=suffixes.map(s=>[...prefix,...s].map(u=>cat.commands.indexOf(u)));
  const candidates=actions.map(word=>{
    const forcing=cat.rates.map(r=>normalizedForcing(r,word)),pairs=[];
    for(let j=1;j<forcing.length;j++)for(let i=0;i<j;i++){
      const polygon=projectPlane(forcing[i],forcing[j],cat.error);
      if(polygon.length)pairs.push({i,j,polygon});
    }
    return pairs;
  });
  const polygons=candidates.map(pairs=>pairs.map(p=>({laws:[cat.ids[p.i],cat.ids[p.j]],vertices:p.polygon.map(v=>v.map(fmt))})));
  const base={schema:SUFFIX_PLAN,source,prefix,suffixes,polygons};
  const bad=unsafeThirdBands(candidates);
  if(!bad.length)return {...base,status:'suffix-certified'};
  const x=bad[0][0],y=trappedSections(candidates,x)[0][0],readings=[Z(),Z(),x,y];
  const branches=candidates.map((pairs,i)=>{
    const pair=pairs.find(p=>{const band=section(p.polygon,x);return band&&contains(band,y);});
    return {suffix:i,...physicalBranch(cat,actions[i],pair,readings)};
  });
  return {...base,status:'suffix-refuted',collision:{prefixReadings:readings.map(fmt),branches}};
}

export function choosePlanarSuffix(polygons,values){
  const [a,b,c,d]=values.slice(0,4).map(rational);
  const x=add(sub(c,times(2,b)),a),y=add(sub(d,times(3,b)),times(2,a));
  const selected=polygons.findIndex(pairs=>pairs.every(pair=>{
    const band=section(pair.vertices.map(v=>v.map(rational)),x);
    return !band||!contains(band,y);
  }));
  need(selected>=0,'a feasible measured prefix has no safe suffix');
  return selected;
}
