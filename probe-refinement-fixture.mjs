import assert from 'node:assert/strict';
import {syntheticChallenge} from './src/unknown-lab/paired-history.mjs';
import {referenceExample} from './src/unknown-lab/reference-example.mjs';
import {createReferenceSequence,analyzeReferenceSequence,compareNextReferenceOffers,freezeNextReferenceRound,referenceRoundRequest,receiveReferenceSequence,exportReferenceSequence,importReferenceSequence} from './src/unknown-lab/reference-sequence.mjs';
const f=t=>-Math.expm1(-t/1.3);let nextSeed=100;
function run(id,t,m,r,sigma=1e-8){
 const notebook=(target,seed)=>syntheticChallenge({count:32,seed,noiseSigma:sigma,duration:t,effect:target/f(t),orderStrategy:'shuffled'});
 return {id,role:'challenge',duration:t,main:{acquisitionId:id+'-main',notebook:notebook(m,++nextSeed)},reference:{acquisitionId:id+'-ref',notebook:notebook(r,++nextSeed)}};
}
const study=referenceExample();study.gainBounds=[0,2];study.runs=[.3,1,3].map((t,i)=>({...run('train'+i,t,f(t),f(t)),role:'training'}));
const input={schema:'worldlaw.reference-models/v1',study,amplitudeBounds:[.2,.6],taus:[1.3]};
const offer={id:'suppressed',duration:2,referenceInterval:[-.0001,.0001],radius:.0001};


const zeroRef={...input,study:{...input.study,runs:[.3,1,3].map((t,i)=>({...run('zero-ref-'+i,t,.4*f(t),0),role:'training'}))}};
let account=createReferenceSequence(zeroRef);
const offers=[{id:'again-zero',duration:2,referenceInterval:[0,0],radius:.0001},{id:'reference-one',duration:2,referenceInterval:[1,1],radius:.0001}];
const before=compareNextReferenceOffers(account,offers);
account=freezeNextReferenceRound(account,offers[1],{id:'learn-gain',prospectiveDeclaration:true});
account=receiveReferenceSequence(account,{schema:'worldlaw.reference-sequence-acquisition/v1',request:referenceRoundRequest(account),runs:[run('gain-actual',2,1.2+.4*f(2),1)]});
const after=compareNextReferenceOffers(account,offers);
export {account,zeroRef};
