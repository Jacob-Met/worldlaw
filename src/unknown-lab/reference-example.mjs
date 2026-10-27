import {syntheticChallenge} from './paired-history.mjs';
import {REFERENCE_SCHEMA} from './reference-channel.mjs';
export function referenceExample(kind='artifact-only'){
 if(!['artifact-only','additional-effect','changing-gain','negative-gain','zero-reference'].includes(kind))throw new Error('Unknown authored reference control.');
 const runs=[.3,1,3,.6,2,5].map((duration,i)=>{
  const artifact=.7*(-Math.expm1(-duration/1.5));
  const gain=kind==='negative-gain'?-1:kind==='changing-gain'?(i%2?1.18:.82):1;
  const targetMain=gain*artifact+(kind==='additional-effect'?.4:0);
  const targetReference=kind==='zero-reference'?0:artifact;
  function notebook(target,seed){
   return syntheticChallenge({count:32,seed,noiseSigma:.003,duration,effect:target/(-Math.expm1(-duration/1.3)),orderStrategy:'shuffled'});
  }
  return {id:'duration-'+(i+1),role:i<3?'training':'challenge',duration,
   main:{acquisitionId:'authored-main-'+(i+1),notebook:notebook(targetMain,200+i*2)},
   reference:{acquisitionId:'authored-reference-'+(i+1),notebook:notebook(targetReference,201+i*2)}};
 });
 return {schema:REFERENCE_SCHEMA,gainBounds:kind==='negative-gain'?[-1.2,-.8]:[.8,1.2],assumptions:{
  referenceInsensitivity:'Authored reference contains the simulated artifact but no additional preparation effect.',
  sharedArtifact:'Both independently seeded authored channels share the declared saturation-shaped artifact.',
  stableGain:'One gain within the declared bounds applies at all durations. The changing-gain control deliberately violates this assumption.'},runs};
}
