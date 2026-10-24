import assert from 'node:assert/strict';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {analyzeCouplingNotebook} from '../src/coupling/notebook.mjs';
import {predictCoupling,discoverCoupling} from '../src/coupling/science.mjs';
import {circulationExample} from '../src/coupling/circulation.mjs';
import {inspectCoupledResponseRegions} from '../src/coupling/response-region.mjs';
export function authoredContrast(){
const notebook=createCouplingCourse(),analysis=analyzeCouplingNotebook(notebook),model=analysis.discovery.candidates.find(m=>m.id==='reciprocal');
const mid=model.domain.map(d=>(d.min+d.max)/2),step=model.domain.map(d=>(d.max-d.min)*.05);
const qs=[mid,[mid[0]+step[0],mid[1]],[mid[0]+step[0],mid[1]+step[1]],[mid[0],mid[1]+step[1]],mid];
const path=circulationExample(notebook.assumptions.coordinateConvention);path.source.label='Authored cross-row shared-reading counterexample; no physical data';
path.samples=qs.map(q=>({q,torque:predictCoupling(model,q),torqueRadius:[.001,.001]}));
const radius=.05,read=()=>inspectCoupledResponseRegions(notebook,path,radius).candidates.find(m=>m.modelId==='reciprocal');
const baseline=read();
const signs=baseline.rows.slice(0,2).map((r,index)=>r.generators.map(g=>Math.sign(g[0])*(index===0?1:-1)));
for(let rowIndex=0;rowIndex<2;rowIndex++){
 const r=baseline.rows[rowIndex],shift=[0,1].map(a=>r.generators.reduce((s,g,i)=>s+g[a]*signs[rowIndex][i],0));
 path.samples[rowIndex].torque=r.center.map((v,a)=>v+shift[a]);
 const training=analysis.discovery.observations.map((r,i)=>({...r,torque:r.torque.map((v,a)=>v+radius*signs[rowIndex][2*i+a])}));
 const refit=discoverCoupling(training,notebook.options).candidates.find(m=>m.id==='reciprocal');
 assert.ok(predictCoupling(refit,qs[rowIndex]).every((v,a)=>Math.abs(v-path.samples[rowIndex].torque[a])<1e-10));
}

return {notebook,path,model,analysis,signs,radius};
}
