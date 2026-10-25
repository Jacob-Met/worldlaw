/** Original authored pixel movies for marker-first receiving; not physical footage. */
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {once} from 'node:events';
const directory=resolve(process.argv[2]||'.receipts/path-reference-fixtures');
await mkdir(directory,{recursive:true});
const width=320,height=240,fps=30,count=61;
const definitions=[
  {name:'circle-a',center:{x:155,y:70},radius:90,start:-.8,span:1.6},
  {name:'circle-b',center:{x:130,y:90},radius:74,start:-.9,span:1.8},
  {name:'line'}
];
const truth={kind:'original authored synthetic image movies; not physical observations',width,height,fps,courses:[]};
for(const def of definitions){
  const frames=Array.from({length:count},(_,i)=>{
    const theta=def.center?def.start+def.span*i/(count-1):null;
    const point=def.center?{x:Math.round(def.center.x+def.radius*Math.sin(theta)),y:Math.round(def.center.y+def.radius*Math.cos(theta))}
      :{x:50+3*i,y:100+Math.round(i/2)};
    return {time:i/fps,point,angle:def.center?Math.atan2(point.x-def.center.x,point.y-def.center.y):null};
  });
  const file=resolve(directory,'authored-'+def.name+'.webm');
  const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24',
    '-video_size',width+'x'+height,'-framerate',String(fps),'-i','pipe:0','-an','-c:v','libvpx-vp9',
    '-lossless','1','-pix_fmt','yuv444p',file],{stdio:['pipe','ignore','pipe']});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);const finished=once(child,'close');
  for(const row of frames){
    const frame=Buffer.alloc(width*height*3);
    const pixel=(x,y,color)=>{if(x<0||y<0||x>=width||y>=height)return;const offset=(y*width+x)*3;for(let c=0;c<3;c++)frame[offset+c]=color[c];};
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixel(x,y,x%20===0||y%20===0?[25,39,53]:[15,25,38]);
    for(let y=-7;y<=7;y++)for(let x=-7;x<=7;x++){
      const hash=Math.imul(x+24,374761393)^Math.imul(y+38,668265263);
      const value=45+((hash^(hash>>>13))>>>0)%165;
      pixel(row.point.x+x,row.point.y+y,[Math.min(255,value+40),value,Math.round(value*.65)]);
    }
    if(!child.stdin.write(frame))await once(child.stdin,'drain');
  }
  child.stdin.end();const [code]=await finished;
  if(code!==0)throw new Error('ffmpeg failed '+code+': '+stderr);
  truth.courses.push({...def,file:'authored-'+def.name+'.webm',frames});console.log(file);
}
await writeFile(resolve(directory,'truth.json'),JSON.stringify(truth,null,2)+'\n');
