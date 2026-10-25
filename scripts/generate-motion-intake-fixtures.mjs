/** Independently authored oscillator pixels; no WORLDLAW fitter or simulator is used. */
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=resolve(process.argv[2]||'.receipts/motion-intake-fixtures');
await mkdir(directory,{recursive:true});
const width=360,height=260,fps=30,count=241;
const courses=[
 {name:'fit',amplitude:.8,decay:.12,frequency:2.4,center:{x:180,y:65},radius:115},
 {name:'challenge',amplitude:1.15,decay:.12,frequency:2.4,center:{x:175,y:72},radius:108},
 {name:'different-law',amplitude:1.05,decay:.12,frequency:1.75,center:{x:178,y:68},radius:110}
];
const truth={kind:'authored synthetic pixel movies, not physical footage',width,height,fps,courses:[]};
for(const course of courses){
 const frames=Array.from({length:count},(_,i)=>{
  const time=i/fps,angle=course.amplitude*Math.exp(-course.decay*time)*
    (Math.cos(course.frequency*time)+course.decay/course.frequency*Math.sin(course.frequency*time));
  return {time,angle,point:{x:Math.round(course.center.x+course.radius*Math.sin(angle)),
    y:Math.round(course.center.y+course.radius*Math.cos(angle))}};
 });
 const file='oscillator-'+course.name+'.webm';
 const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24',
  '-video_size',width+'x'+height,'-framerate',String(fps),'-i','pipe:0','-an','-c:v','libvpx-vp9',
  '-lossless','1','-pix_fmt','yuv444p',resolve(directory,file)],{stdio:['pipe','ignore','pipe']});
 let error='';child.stderr.on('data',bytes=>error+=bytes);const finished=once(child,'close');
 for(const {point} of frames){
  const frame=Buffer.alloc(width*height*3);
  const pixel=(x,y,r,g,b)=>{if(x<0||y<0||x>=width||y>=height)return;const j=(y*width+x)*3;frame[j]=r;frame[j+1]=g;frame[j+2]=b;};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixel(x,y,15,25,38);
  for(let y=-7;y<=7;y++)for(let x=-7;x<=7;x++){
   const h=Math.imul(x+24,374761393)^Math.imul(y+38,668265263),v=45+((h^(h>>>13))>>>0)%165;
   pixel(point.x+x,point.y+y,Math.min(255,v+40),v,Math.round(v*.65));
  }
  if(!child.stdin.write(frame))await once(child.stdin,'drain');
 }
 child.stdin.end();const [exit]=await finished;if(exit!==0)throw new Error(error);
 truth.courses.push({...course,file,frames,initialRate:0,equation:{rate:-2*course.decay,spring:-(course.frequency**2+course.decay**2)}});
 console.log('Wrote '+file);
}
await writeFile(resolve(directory,'truth.json'),JSON.stringify(truth,null,2)+'\n');
