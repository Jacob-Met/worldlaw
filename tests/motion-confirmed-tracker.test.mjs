import test from 'node:test';
import assert from 'node:assert/strict';
import {createTemplate,trackTemplate,CONFIRMED_GRID_TRACKER_VERSION,COLOR_CONFIRMED_GRID_TRACKER_VERSION,GRID_TRACKER_VERSION} from '../src/motion/tracker.mjs';

function noise(width=96,height=96) {
  let seed=7;const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed>>>24;data.set([v,v,v,255],i);}
  return {width,height,data};
}
const center={x:48,y:48};
function capture(frame,point=center,options={}) {
  const r=createTemplate(frame,point,{patchRadius:8,sampleStep:2,confirmFullPixel:true,...options});
  assert.equal(r.status,'ready',r.reason);return r.template;
}
function fullVector(frame,p,radius,color) {
  const rows=[];
  const at=(x,y)=>{const i=(y*frame.width+x)*4,[r,g,b,a]=frame.data.slice(i,i+4);return [(.299*r+.587*g+.114*b)*a/255,(r-g)*a/255,(b-(r+g)/2)*a/255];};
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    const x=p.x+dx,y=p.y+dy,l=Math.floor(x),t=Math.floor(y),fx=x-l,fy=y-t;
    const a=at(l,t),b=at(l+1,t),c=at(l,t+1),d=at(l+1,t+1);
    rows.push(a.map((v,k)=>(v*(1-fx)+b[k]*fx)*(1-fy)+(c[k]*(1-fx)+d[k]*fx)*fy));
  }
  const mean=rows.reduce((s,r)=>s+r[0],0)/rows.length;
  const v=rows.flatMap(r=>color?[r[0]-mean,r[1],r[2]]:[r[0]-mean]),norm=Math.hypot(...v);
  return v.map(x=>x/norm);
}

test('full original pixels reject the retained skipped-pixel alias without lending a position',()=>{
  const source=noise(),changed={...source,data:new Uint8ClampedArray(source.data)};
  for(let y=40;y<=56;y++)for(let x=40;x<=56;x++)if(x%2||y%2){const i=(y*96+x)*4,v=255-changed.data[i];changed.data.set([v,v,v,255],i);}
  const legacy=trackTemplate(changed,createTemplate(source,center,{patchRadius:8,sampleStep:2}).template,center,{searchRadius:8,subpixel:false});
  assert.equal(legacy.status,'accepted');assert.ok(legacy.score>.999999);
  for(const appearance of ['luminance','color']){
    const r=trackTemplate(changed,capture(source,center,{appearance}),center,{searchRadius:8,subpixel:false});
    assert.equal(r.status,'lost');assert.equal(r.point,null);assert.deepEqual(r.candidatePoint,center);
    assert.equal(r.reason,'full-pixel-candidate-score-below-threshold');assert.ok(r.score>.999999);
    assert.equal(r.confirmation.status,'failed');assert.ok(r.confirmation.score<.3);
  }
});

test('full-pixel scores at actual fractional candidate coordinates match an independent byte-feature oracle',()=>{
  const source=noise();for(let i=0;i<source.data.length;i+=4){source.data[i+1]=Math.min(255,source.data[i]+20);source.data[i+2]=Math.max(0,source.data[i]-30);}
  const point={x:48.2,y:48.15};
  for(const appearance of ['luminance','color']){
    const t=capture(source,point,{appearance}),r=trackTemplate(source,t,point,{searchRadius:8});
    assert.equal(r.status,'accepted',JSON.stringify(r));assert.equal(r.confirmation.status,'passed');
    const a=fullVector(source,point,8,appearance==='color'),b=fullVector(source,r.point,8,appearance==='color');
    const expected=a.reduce((s,v,i)=>s+v*b[i],0);assert.ok(Math.abs(expected-r.confirmation.score)<1e-6);
    assert.equal(t.version,appearance==='color'?COLOR_CONFIRMED_GRID_TRACKER_VERSION:CONFIRMED_GRID_TRACKER_VERSION);
    assert.equal(r.settings.confirmFullPixel,true);assert.ok(Object.isFrozen(t.confirmationTemplate.normalizedValues));
  }
});

test('the complete candidate must retain texture even when its sampled lattice has enough',()=>{
  const source=noise(),target={...source,data:new Uint8ClampedArray(source.data)};
  for(let y=40;y<=56;y++)for(let x=40;x<=56;x++){
    const i=(y*96+x)*4;const v=x%2===0&&y%2===0?(source.data[i]>127?134:122):128;
    target.data.set([v,v,v,255],i);
  }
  const r=trackTemplate(target,capture(source),center,{searchRadius:8,subpixel:false,minScore:0,minMargin:0});
  assert.deepEqual(r.candidatePoint,center);assert.equal(r.status,'low-texture');assert.equal(r.reason,'full-pixel-candidate-low-texture');
  assert.ok(r.textureStd>=5);assert.ok(r.confirmation.textureStd<5);assert.equal(r.point,null);
});

test('confirmation cannot rescue sparse ambiguity or a boundary winner, and identical patches do not establish identity',()=>{
  const source=noise(),target=noise(),t=capture(source);
  for(const cx of [29,67])for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){
    const a=((48+dy)*96+48+dx)*4,b=((48+dy)*96+cx+dx)*4;target.data.set(source.data.slice(a,a+4),b);
  }
  const ambiguous=trackTemplate(target,t,center,{searchRadius:24,subpixel:false});
  assert.equal(ambiguous.status,'ambiguous');assert.equal(ambiguous.reason,'competing-match');assert.equal(ambiguous.confirmation.status,'not-evaluated');
  const boundary=trackTemplate(source,t,{x:40,y:48},{searchRadius:8,subpixel:false});
  assert.equal(boundary.reason,'search-boundary');assert.equal(boundary.confirmation.status,'not-evaluated');
  // A single exact visual copy passes; pixel equality alone cannot establish physical identity.
  const copy=trackTemplate(source,t,center,{searchRadius:8,subpixel:false});assert.equal(copy.status,'accepted');assert.ok(copy.confirmation.score>.999999);
});

test('a complete confirmation patch is reserved within the same comparison cap',()=>{
  const source=noise(173,304),point={x:86,y:151};
  const legacy=createTemplate(source,point,{patchRadius:24,sampleStep:2}).template;
  assert.equal(trackTemplate(source,legacy,point,{searchRadius:128,subpixel:false}).candidateCount,32000);
  assert.throws(()=>trackTemplate(source,capture(source,point,{patchRadius:24}),point,{searchRadius:128,subpixel:false}),/20 million/);
  const admitted=trackTemplate(source,capture(source,point,{patchRadius:24}),point,{searchRadius:88});
  assert.equal(admitted.status,'accepted');assert.ok((admitted.candidateCount+1)*625+2401<=20_000_000);
});

test('version, full source patch and sampling declarations cannot silently disagree',()=>{
  const source=noise(),t=capture(source),full=t.confirmationTemplate;
  for(const changed of [{version:GRID_TRACKER_VERSION},{confirmFullPixel:false},{confirmationTemplate:undefined},
    {confirmationTemplate:{...full,sourcePoint:{x:49,y:48}}},{confirmationTemplate:{...full,patchRadius:7}},
    {confirmationTemplate:{...full,normalizedValues:full.normalizedValues.map(x=>x*2)}}])assert.throws(()=>trackTemplate(source,{...t,...changed},center));
  assert.throws(()=>createTemplate(source,center,{sampleStep:1,confirmFullPixel:true}),/two-pixel/);
  assert.throws(()=>createTemplate(source,center,{patchRadius:8,sampleStep:2,confirmFullPixel:'yes'}),/boolean/);
  const hidden={...source,data:new Uint8ClampedArray(source.data)};for(let i=3;i<hidden.data.length;i+=4)hidden.data[i]=0;
  assert.equal(trackTemplate(hidden,t,center).point,null);assert.equal(createTemplate(hidden,center,{patchRadius:8,sampleStep:2,confirmFullPixel:true}).status,'low-texture');
  assert.equal(trackTemplate(noise(97,96),t,center).reason,'frame-size-changed');
});
