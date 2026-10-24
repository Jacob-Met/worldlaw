import test from 'node:test';
import assert from 'node:assert/strict';
import {createTemplate, trackTemplate, TRACKER_VERSION, COLOR_TRACKER_VERSION} from '../src/motion/tracker.mjs';

const colors = {red:[50,-20,-28], yellow:[24,4,-84], blue:[-25,-10,75], gray:[0,0,0]};
function frame(width=120,height=90,fill=[60,60,60]) {
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<data.length;i+=4){data.set(fill,i);data[i+3]=255;}
  return {width,height,data};
}
function stamp(image,x,y,color='red',radius=7,transform=v=>v) {
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++) {
    const hash=Math.imul(dx+19,374761393)^Math.imul(dy+23,668265263);
    const level=100+((hash^(hash>>>13))>>>0)%51,index=((y+dy)*image.width+x+dx)*4;
    for(let c=0;c<3;c++)image.data[index+c]=transform(level+colors[color][c]);
  }
  return image;
}
const anchor={x:50,y:45};
const capture=(source=stamp(frame(),50,45),options={})=>{
  const result=createTemplate(source,anchor,{appearance:'color',...options});
  assert.equal(result.status,'ready');return result.template;
};
function oracle(source,p,target,q,radius=7) {
  // Independent direct vector construction from byte samples, without tracker helpers.
  const features=(im,point)=>{
    const triples=[];let sum=0;
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++) {
      const i=((point.y+dy)*im.width+point.x+dx)*4,alpha=im.data[i+3]/255;
      const [r,g,b]=[im.data[i],im.data[i+1],im.data[i+2]].map(v=>v*alpha);
      const l=.299*r+.587*g+.114*b;sum+=l;triples.push([l,r-g,b-(r+g)/2]);
    }
    const mean=sum/triples.length,vector=triples.flatMap(([l,rg,by])=>[l-mean,rg,by]);
    const norm=Math.hypot(...vector);return vector.map(v=>v/norm);
  };
  const a=features(source,p),b=features(target,q);return a.reduce((sum,v,i)=>sum+v*b[i],0);
}

test('color distinguishes identical brightness patterns without changing the default ambiguity gate',()=>{
  const source=stamp(frame(),50,45),target=stamp(stamp(frame(),35,45,'red'),67,45,'yellow');
  const legacy=createTemplate(source,anchor).template;
  const brightness=trackTemplate(target,legacy,anchor,{searchRadius:24,subpixel:false});
  assert.equal(brightness.version,TRACKER_VERSION);assert.equal(brightness.status,'ambiguous');assert.equal(brightness.point,null);
  const result=trackTemplate(target,capture(source),anchor,{searchRadius:24,subpixel:false});
  assert.equal(result.version,COLOR_TRACKER_VERSION);assert.equal(result.settings.appearance,'color');
  assert.equal(result.status,'accepted',JSON.stringify(result));assert.deepEqual(result.point,{x:35,y:45});
  assert.equal(result.settings.minMargin,brightness.settings.minMargin);
  assert.equal(result.settings.minScore,brightness.settings.minScore);
  assert.ok(Math.abs(result.score-oracle(source,anchor,target,result.point))<1e-7);
});

test('independent feature oracle agrees under neutral illumination changes and copied template is fixed',()=>{
  const source=stamp(frame(),50,45),template=capture(source),before=JSON.stringify(template);
  const target=stamp(frame(),57,41,'red',7,v=>Math.round(.75*v+20));
  const result=trackTemplate(target,template,anchor,{subpixel:false});
  assert.equal(result.status,'accepted',JSON.stringify(result));assert.deepEqual(result.point,{x:57,y:41});
  assert.ok(result.score>.9999);assert.ok(Math.abs(result.score-oracle(source,anchor,target,result.point))<1e-7);
  assert.equal(JSON.stringify(template),before);assert.ok(Object.isFrozen(template.normalizedValues));
  source.data.fill(0);assert.equal(JSON.stringify(template),before);
});

test('same-color duplicate shapes remain ambiguous and an opposite-color substitute cannot become an observation',()=>{
  const duplicate=stamp(stamp(frame(),35,45),67,45),template=capture();
  for(const minMargin of [0,.06]) {
    const result=trackTemplate(duplicate,template,anchor,{minMargin});
    assert.equal(result.status,'ambiguous');assert.equal(result.point,null);assert.ok(Math.abs(result.ambiguityMargin)<1e-10);
  }
  const substitute=trackTemplate(stamp(frame(),57,41,'blue'),template,anchor);
  assert.equal(substitute.status,'lost');assert.equal(substitute.point,null);assert.equal(substitute.reason,'score-below-threshold');
});

test('flat saturated color and transparent hidden texture cannot satisfy the spatial texture gate',()=>{
  for(const minTextureStd of [0,5]) {
    const flat=frame(120,90,[240,10,10]);
    assert.equal(createTemplate(flat,anchor,{appearance:'color',minTextureStd}).status,'low-texture');
    const result=trackTemplate(flat,capture(),anchor,{minTextureStd});
    assert.equal(result.status,'low-texture');assert.equal(result.point,null);
  }
  const hidden=stamp(frame(),50,45);for(let i=3;i<hidden.data.length;i+=4)hidden.data[i]=0;
  assert.equal(createTemplate(hidden,anchor,{appearance:'color'}).status,'low-texture');
  assert.equal(trackTemplate(hidden,capture(),anchor).point,null);
});

test('achromatic inputs preserve the original correlation, location and decisions',()=>{
  const source=stamp(frame(),50,45,'gray'),target=stamp(frame(),57,41,'gray');
  const a=trackTemplate(target,createTemplate(source,anchor).template,anchor);
  const b=trackTemplate(target,capture(source),anchor);
  assert.equal(a.status,b.status);assert.deepEqual(a.point,b.point);
  for(const key of ['score','runnerUpScore','ambiguityMargin','textureStd'])assert.ok(Math.abs(a[key]-b[key])<1e-12,key);
});

test('color retains artificial boundary refusal, frame-size checks, and bounded pixel comparisons',()=>{
  const boundary=trackTemplate(stamp(frame(),62,45),capture(),anchor,{searchRadius:12});
  assert.equal(boundary.status,'ambiguous');assert.equal(boundary.reason,'search-boundary');assert.equal(boundary.point,null);
  assert.equal(trackTemplate(frame(121,90),capture(),anchor).reason,'frame-size-changed');
  const large=stamp(frame(320,320),160,160,'red',24);
  for(const appearance of ['luminance','color']) {
    const template=createTemplate(large,{x:160,y:160},{patchRadius:24,appearance}).template;
    assert.throws(()=>trackTemplate(large,template,{x:160,y:160},{searchRadius:128}),/20 million/);
  }
});

test('unsupported modes and conflicting template provenance refuse before searching',()=>{
  assert.throws(()=>createTemplate(stamp(frame(),50,45),anchor,{appearance:'learned'}),/appearance/);
  const template=capture();
  for(const change of [{version:TRACKER_VERSION},{appearance:'luminance'},
    {normalizedValues:template.normalizedValues.slice(1)},
    {normalizedValues:template.normalizedValues.map((v,i)=>i%3===1?1/template.size:0)},
    {normalizedValues:template.normalizedValues.map((v,i)=>i%3===0?v+.01:v)}])
    assert.throws(()=>trackTemplate(frame(),{...template,...change},anchor));
});
