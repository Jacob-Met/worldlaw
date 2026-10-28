import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {reserveReferenceProductWork as reserve,screenReferenceProducts as score} from './src/unknown-lab/reference-product-faces.mjs';
const parts=Array.from({length:9},()=>[[1,0],[2,0],[2,1],[1,1]]), signs=parts.map(()=>1), us=parts.map((_,i)=>[1,(i+1)/16]), vs=parts.map((_,i)=>[.5,(i+2)/16]);
const work=reserve(parts,signs,29),start=performance.now(),results=[];
for(let i=0;i<29;i++){const r=score(parts,signs,us,vs,.125,.0625);results.push({status:r.status,reason:r.reason,work:r.work,width:r.worstRemainingWidth});}
const receipt={runtime:process.version,platform:process.platform,work,elapsedMs:performance.now()-start,computed:results.filter(r=>r.status==='computed').length,results};writeFileSync('benchmark-family-result.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
