import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {analyzeCouplingNotebook} from '../src/coupling/notebook.mjs';
import {predictCoupling,discoverCoupling} from '../src/coupling/science.mjs';
import {circulationExample} from '../src/coupling/circulation.mjs';
export function sharedCourseFixture(){
const n=createCouplingCourse(),analysis=analyzeCouplingNotebook(n),model=analysis.discovery.candidates.find(m=>m.id==='reciprocal');
const p=circulationExample(n.assumptions.coordinateConvention);p.source.label='Authored whole-course shared-error contradiction; no physical data';
const qs=[[-.01,0],[0,0],[.01,0],[.01,.01],[-.01,.01],[-.01,0]];
p.samples=qs.map((q,i)=>({q,torque:predictCoupling(model,q).map((v,a)=>v+(a===0?(i===1?.04:-.04):0)),torqueRadius:[.001,.001]}));
return {notebook:n,path:p,analysis,model};
}

export function compatibleSharedCourseFixture(){const f=sharedCourseFixture(),shifted=f.analysis.discovery.observations.map((r,i)=>({...r,torque:r.torque.map((v,a)=>v+.03*Math.sin(i+a))})),m=discoverCoupling(shifted,f.notebook.options).candidates.find(m=>m.id==='reciprocal');f.path.source.label='Authored common training-offset course; no physical data';f.path.samples.forEach(r=>{r.torque=predictCoupling(m,r.q);r.torqueRadius=[.001,.002];});return f;}
