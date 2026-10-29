// Reconstructed research residual primitive. No production fallback.
import {productPair} from './split-column.mjs';
function sum(a,b){const s=a+b,v=s-a;return [s,(a-(s-v))+(b-v)];}
function add(a,b){const [s,e]=sum(a[0],b[0]),[h,l]=sum(s,e+a[1]+b[1]);return [h,l];}
export function splitResidual(columnRows,target,pairs){return target.map((y,i)=>{let r=[y,0];for(let j=0;j<pairs.length;j++){for(const part of pairs[j]){const p=productPair(columnRows[j][i],part);r=add(r,[-p[0],-p[1]]);}}return r[0]+r[1];});}
