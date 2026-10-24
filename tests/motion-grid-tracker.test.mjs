import test from 'node:test';
import assert from 'node:assert/strict';
import {createTemplate,trackTemplate,TRACKER_VERSION,COLOR_TRACKER_VERSION,GRID_TRACKER_VERSION,COLOR_GRID_TRACKER_VERSION} from '../src/motion/tracker.mjs';

function frame(width=120,height=90) {
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<data.length;i+=4)data.set([60,60,60,255],i);
  return {width,height,data};
}
function stamp(im,cx,cy,radius=8,{invertSkipped=false}={}) {
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++) {
    const h=Math.imul(dx+19,374761393)^Math.imul(dy+23,668265263);
    let l=65+((h^(h>>>13))>>>0)%125;
    if(invertSkipped&&(dx%2!==0||dy%2!==0))l=255-l;
    const i=((cy+dy)*im.width+cx+dx)*4;im.data.set([l+35,l-15,l-20,255],i);
  }
  return im;
}
const p={x:50,y:45};
const capture=(im=stamp(frame(),p.x,p.y),options={})=>{
  const r=createTemplate(im,p,{patchRadius:8,sampleStep:2,...options});
  assert.equal(r.status,'ready');return r.template;
};

// Independent vector oracle samples original byte-derived features with bilinear
// interpolation. It neither calls tracker scoring nor uses its normalized values.
function vector(im,point,radius,step,appearance) {
  const color=appearance==='color';let sum=0;const rows=[];
  const feature=(x,y)=>{const i=(y*im.width+x)*4,[r,g,b,a]=im.data.slice(i,i+4);
    return [(.299*r+.587*g+.114*b)*a/255,(r-g)*a/255,(b-(r+g)/2)*a/255];};
  for(let dy=-radius;dy<=radius;dy+=step)for(let dx=-radius;dx<=radius;dx+=step) {
    const x=point.x+dx,y=point.y+dy,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
    const a=feature(x0,y0),b=feature(Math.min(x0+1,im.width-1),y0),c=feature(x0,Math.min(y0+1,im.height-1)),d=feature(Math.min(x0+1,im.width-1),Math.min(y0+1,im.height-1));
    const row=a.map((v,k)=>(v*(1-fx)+b[k]*fx)*(1-fy)+(c[k]*(1-fx)+d[k]*fx)*fy);
    sum+=row[0];rows.push(row);
  }
  const mean=sum/rows.length,values=rows.flatMap(r=>color?[r[0]-mean,r[1],r[2]]:[r[0]-mean]);
  const norm=Math.hypot(...values);return values.map(v=>v/norm);
}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);

test('dense defaults retain their prior versions and identical explicit one-pixel results',()=>{
  const source=stamp(frame(),p.x,p.y),target=stamp(frame(),59,39);
  for(const appearance of ['luminance','color']) {
    const a=createTemplate(source,p,{patchRadius:8,appearance}).template;
    const b=createTemplate(source,p,{patchRadius:8,appearance,sampleStep:1}).template;
    assert.deepEqual(a,b);assert.equal(a.version,appearance==='color'?COLOR_TRACKER_VERSION:TRACKER_VERSION);
    assert.deepEqual(trackTemplate(target,a,p),trackTemplate(target,b,p));
  }
});

test('sampled support permits a wider actual-pixel search and still visits odd integer positions',()=>{
  const center={x:192,y:192},source=stamp(frame(384,384),192,192,14),target=stamp(frame(384,384),281,211,14);
  for(const appearance of ['luminance','color']) {
    const dense=createTemplate(source,center,{patchRadius:14,appearance}).template;
    assert.throws(()=>trackTemplate(target,dense,center,{searchRadius:128}),/20 million/);
    const sparse=createTemplate(source,center,{patchRadius:14,appearance,sampleStep:2}).template;
    const result=trackTemplate(target,sparse,center,{searchRadius:128,subpixel:false});
    assert.equal(sparse.size,15);assert.equal(result.candidateCount,257**2);
    assert.equal(result.status,'accepted',JSON.stringify(result));assert.deepEqual(result.point,{x:281,y:211});
    assert.equal(result.version,appearance==='color'?COLOR_GRID_TRACKER_VERSION:GRID_TRACKER_VERSION);
    assert.equal(result.settings.sampleStep,2);assert.ok(Math.abs(result.score-1)<1e-7);
  }
});

test('fractional capture and sampled score agree with an independent original-pixel feature oracle',()=>{
  const source=stamp(frame(),p.x,p.y),point={x:50.25,y:45.5};
  for(const appearance of ['luminance','color']) {
    const t=createTemplate(source,point,{patchRadius:8,sampleStep:2,appearance}).template;
    const expected=vector(source,point,8,2,appearance);
    assert.equal(t.normalizedValues.length,expected.length);
    expected.forEach((v,i)=>assert.ok(Math.abs(v-t.normalizedValues[i])<1e-7));
    const r=trackTemplate(source,t,point,{searchRadius:8});
    const score=dot(expected,vector(source,r.candidatePoint,8,2,appearance));
    assert.ok(Math.abs(score-r.score)<1e-6,JSON.stringify({score,actual:r.score}));
  }
});

test('negative control: changed unsampled pixels can be invisible to the sparse profile',()=>{
  let seed=7;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
  const source=frame(80,80);for(let i=0;i<source.data.length;i+=4){const v=rand();source.data.set([v,v,v,255],i);}
  const changed={...source,data:new Uint8ClampedArray(source.data)},point={x:40,y:40};
  for(let y=32;y<=48;y++)for(let x=32;x<=48;x++)if((x-40)%2!==0||(y-40)%2!==0){const i=(y*80+x)*4,v=255-changed.data[i];changed.data.set([v,v,v,255],i);}
  const dense=trackTemplate(changed,createTemplate(source,point,{patchRadius:8}).template,point,{searchRadius:8,subpixel:false});
  const sparse=trackTemplate(changed,createTemplate(source,point,{patchRadius:8,sampleStep:2}).template,point,{searchRadius:8,subpixel:false});
  assert.equal(dense.status,'lost');assert.equal(dense.point,null);
  assert.equal(sparse.status,'accepted');assert.deepEqual(sparse.point,point);assert.ok(Math.abs(sparse.score-1)<1e-12);
});

test('two patches that agree only on the sampled lattice remain ambiguous',()=>{
  const source=stamp(frame(),p.x,p.y),target=stamp(stamp(frame(),35,45),69,45,8,{invertSkipped:true});
  for(const appearance of ['luminance','color']) {
    const t=capture(source,{appearance});
    for(const minMargin of [0,.06]) {
      const r=trackTemplate(target,t,p,{searchRadius:24,subpixel:false,minMargin});
      assert.equal(r.status,'ambiguous');assert.equal(r.reason,'competing-match');assert.equal(r.point,null);
      assert.ok(Math.abs(r.ambiguityMargin)<1e-10);
    }
  }
});

test('sampled profiles retain low-texture, hidden-alpha, boundary and source-size refusals',()=>{
  for(const appearance of ['luminance','color']) {
    const t=capture(undefined,{appearance}),flat=frame(),hidden=stamp(frame(),p.x,p.y);
    for(let i=3;i<hidden.data.length;i+=4)hidden.data[i]=0;
    assert.equal(createTemplate(flat,p,{patchRadius:8,sampleStep:2,appearance}).status,'low-texture');
    assert.equal(createTemplate(hidden,p,{patchRadius:8,sampleStep:2,appearance}).status,'low-texture');
    assert.equal(trackTemplate(flat,t,p).status,'low-texture');assert.equal(trackTemplate(hidden,t,p).point,null);
    const edge=trackTemplate(stamp(frame(),62,45),t,p,{searchRadius:12});
    assert.equal(edge.status,'ambiguous');assert.equal(edge.reason,'search-boundary');assert.equal(edge.point,null);
    assert.equal(trackTemplate(frame(121,90),t,p).reason,'frame-size-changed');
  }
});

test('sampling profile and version cannot disagree; asymmetric or unsupported grids refuse',()=>{
  const source=stamp(frame(),p.x,p.y),t=capture(source),color=capture(source,{appearance:'color'});
  for(const sampleStep of [0,1.5,3,NaN])assert.throws(()=>createTemplate(source,p,{patchRadius:8,sampleStep}));
  assert.throws(()=>createTemplate(source,p,{patchRadius:7,sampleStep:2}),/even patch radius/);
  for(const change of [{sampleStep:1},{sampleStep:undefined},{version:TRACKER_VERSION},{size:17},{patchRadius:7}])
    assert.throws(()=>trackTemplate(source,{...t,...change},p));
  assert.throws(()=>trackTemplate(source,{...color,version:GRID_TRACKER_VERSION},p));
  assert.throws(()=>trackTemplate(source,{...t,appearance:'color'},p));
});

test('sample comparison admission includes the optional refined patch and preserves immutable source',()=>{
  const source=stamp(frame(384,384),192,192,24),point={x:192,y:192};
  const t=createTemplate(source,point,{patchRadius:24,sampleStep:2}).template,before=JSON.stringify(t);
  assert.throws(()=>trackTemplate(source,t,point,{searchRadius:128}),/20 million/);
  // 177²*625=19,580,625; reservation adds625 and remains below the limit.
  const result=trackTemplate(source,t,point,{searchRadius:88});assert.equal(result.status,'accepted');
  assert.ok((result.candidateCount+1)*t.size**2<=20_000_000);
  const exact=stamp(frame(173,304),86,151,24),center={x:86,y:151};
  const capped=createTemplate(exact,center,{patchRadius:24,sampleStep:2}).template;
  const atLimit=trackTemplate(exact,capped,center,{searchRadius:128,subpixel:false});
  assert.equal(atLimit.candidateCount,32000);assert.equal(atLimit.status,'accepted');
  assert.throws(()=>trackTemplate(exact,capped,center,{searchRadius:128,subpixel:true}),/20 million/);
  source.data.fill(0);assert.equal(JSON.stringify(t),before);assert.ok(Object.isFrozen(t.normalizedValues));
});
