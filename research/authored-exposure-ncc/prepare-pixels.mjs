// Optional browser fixtures; generated authored pixels, not acquired media.
import {render} from './render.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=new URL('pixels/',import.meta.url);await mkdir(dir,{recursive:true});
for(const[name,q]of[['source',()=>0],['stationary',()=>0],['quadratic0.2',t=>.2*t*t],['quadratic0.8',t=>.8*t*t],['quadratic2.4',t=>2.4*t*t],['complete-turn',t=>2*Math.PI*t]]) {
 const frame=render(q,name==='source'?1:512);await writeFile(new URL(name+'.rgba',dir),frame.frame.data);
}
