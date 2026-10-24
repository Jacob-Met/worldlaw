/** Authored synthetic source movies, encoded losslessly. Requires ffmpeg. */
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {once} from 'node:events';

const directory=resolve(process.argv[2]||'.receipts/tracked-pivot-fixtures');
await mkdir(directory,{recursive:true});
const width=320,height=240,fps=20,count=61;
const frames=Array.from({length:count},(_,i)=>{
  const time=i/fps,pivot={x:95+Math.round(22*Math.sin(.9*time)),y:55+Math.round(7*Math.sin(.7*time))};
  const prescribedAngle=.5*Math.cos(2*time),point={x:pivot.x+Math.round(95*Math.sin(prescribedAngle)),y:pivot.y+Math.round(95*Math.cos(prescribedAngle))};
  return {time,pivot,point,angle:Math.atan2(point.x-pivot.x,point.y-pivot.y)};
});
function raster(row,index,variant) {
  const buffer=Buffer.alloc(width*height*3);
  const pixel=(x,y,color)=>{if(x<0||y<0||x>=width||y>=height)return;const i=(y*width+x)*3;for(let c=0;c<3;c++)buffer[i+c]=color[c];};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixel(x,y,x%20===0||y%20===0?[28,43,59]:[18,28,42]);
  for(let step=0;step<=100;step++) {
    const x=Math.round(row.pivot.x+(row.point.x-row.pivot.x)*step/100),y=Math.round(row.pivot.y+(row.point.y-row.pivot.y)*step/100);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)pixel(x+dx,y+dy,[112,136,153]);
  }
  const stamp=(point,seed,pivot)=>{
    for(let y=-7;y<=7;y++)for(let x=-7;x<=7;x++) {
      const hash=Math.imul(x+19+seed,374761393)^Math.imul(y+23+seed*3,668265263);
      const value=45+((hash^(hash>>>13))>>>0)%165;
      pixel(point.x+x,point.y+y,pivot?[Math.round(value*.65),value,Math.min(255,value+35)]:[Math.min(255,value+40),value,Math.round(value*.65)]);
    }
  };
  const hidden=index>=20&&index<=24;
  if(!(variant==='pivot-hidden'&&hidden))stamp(row.pivot,1,true);
  if(!(variant==='marker-hidden'&&hidden))stamp(row.point,5,false);
  return buffer;
}
for(const variant of ['clean','pivot-hidden','marker-hidden']) {
  const file=resolve(directory,`synthetic-translating-pivot-${variant}.webm`);
  const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',`${width}x${height}`,'-framerate',String(fps),'-i','pipe:0','-an','-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv444p',file],{stdio:['pipe','ignore','pipe']});
  let errors='';child.stderr.on('data',data=>errors+=data);
  const completed=once(child,'close');
  for(let i=0;i<frames.length;i++)if(!child.stdin.write(raster(frames[i],i,variant)))await once(child.stdin,'drain');
  child.stdin.end();const [code]=await completed;
  if(code!==0)throw new Error(`ffmpeg failed (${code}): ${errors}`);
  console.log(file);
}
await writeFile(resolve(directory,'truth.json'),JSON.stringify({kind:'authored synthetic image sequence, not physical acquisition',width,height,fps,frames,hiddenFrames:[20,24]},null,2)+'\n');
