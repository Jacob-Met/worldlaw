import test from 'node:test';import assert from 'node:assert/strict';
import {MODEL_SCHEMA,analyzeReferenceModels,compareReferenceExperiments,predictReferenceModel} from '../src/unknown-lab/reference-models.mjs';
import {referenceExample} from '../src/unknown-lab/reference-example.mjs';
const input=()=>({schema:MODEL_SCHEMA,study:referenceExample(),amplitudeBounds:[0,1],taus:[.5,1.5,3]});
test('maintained notebooks retain nested artifact explanation and full predictions',()=>{const x=input(),r=analyzeReferenceModels(x);assert.ok(r.models.every(m=>m.training.status==='compatible'));const c=compareReferenceExperiments(x,[{id:'blank',duration:1,referenceInterval:[-.01,.01],radius:.01}]);assert.equal(c.recommendation,null);assert.ok(c.comparisons[0].pairs.every(p=>!p.separated));assert.deepEqual(x,input());});
test('challenge values cannot change fitted polygons or offered predictions',()=>{const x=input(),a=compareReferenceExperiments(x,[{id:'one',duration:2,referenceInterval:[0,.1],radius:.02}]);x.study.runs=x.study.runs.filter(r=>r.role==='training');const b=compareReferenceExperiments(x,[{id:'one',duration:2,referenceInterval:[0,.1],radius:.02}]);assert.deepEqual(a.comparisons,b.comparisons);assert.deepEqual(a.analysis.models.map(m=>m.training),b.analysis.models.map(m=>m.training));});
test('signed gain original consumer control remains represented',()=>{const x=input();x.study=referenceExample('negative-gain');const r=analyzeReferenceModels(x);assert.equal(r.models[0].training.status,'compatible');assert.equal(r.models[0].joint.status,'compatible');});
test('inadequate training cannot generate a recommendation',()=>{const x=input();x.study.runs=x.study.runs.slice(0,2);const r=compareReferenceExperiments(x,[{id:'one',duration:2,referenceInterval:[0,.1],radius:.02}]);assert.equal(r.recommendation,null);assert.ok(r.analysis.models.every(m=>m.training.status==='insufficient-training'));});

test('projection retains disconnected sign unions and does not bridge unsupported gap',()=>{
 const m={tau:null,training:{polygons:[{vertices:[[-2,0],[-1,0]]},{vertices:[[1,0],[2,0]]}]}};
 const p=predictReferenceModel(m,{duration:1,referenceInterval:[2,3]});assert.equal(p.length,2);assert.ok(p[0][1]<-1.99&&p[1][0]>1.99);
});
test('full polygon extrema include reference-endpoint and signed gain combinations',()=>{
 const m={tau:1,training:{polygons:[{vertices:[[-2,-1],[3,-1],[3,4],[-2,4]]}]}};
 const p=predictReferenceModel(m,{duration:1,referenceInterval:[-3,2]});const f=1-Math.exp(-1);
 assert.ok(Math.abs(p[0][0]-(-9-f))<1e-7);assert.ok(Math.abs(p[0][1]-(6+4*f))<1e-7);
});
test('bad offered conditions refuse even without adequate training',()=>{
 const x=input();x.study.runs=[];assert.throws(()=>compareReferenceExperiments(x,[{id:'bad',duration:-1,referenceInterval:[0,1],radius:0}]),/duration/);
});
test('parameter and work domains explicitly refuse unsupported grids',()=>{
 for(const mutate of [x=>x.taus=[],x=>x.taus=[1,1],x=>x.taus=[0],x=>x.amplitudeBounds=[-101,1]]){const x=input();mutate(x);assert.throws(()=>analyzeReferenceModels(x));}
});
