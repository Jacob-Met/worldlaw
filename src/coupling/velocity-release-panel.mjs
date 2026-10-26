import {mountReleasePanel} from './release-panel.mjs';
import {VELOCITY_RELEASE_SCHEMA,readVelocityReleaseStudy,exportVelocityReleaseStudy,proposeVelocityReleases,velocityReleaseDynamicsInputs} from './velocity-release.mjs';
import {MATRIX_INPUT_SCHEMA,MATRIX_INTERPRETATION,LOSS_INPUT_SCHEMA,LOSS_INTERPRETATION,readDynamicsInputs} from './dynamics.mjs';

const names={diagonal:'Diagonal loss',symmetric:'Symmetric loss',skew:'Symmetric loss + skew'};
export function mountVelocityReleases(root,options){
 return mountReleasePanel(root,options,{
  prefix:'velocity-release',key:'velocity',schema:VELOCITY_RELEASE_SCHEMA,
  read:readVelocityReleaseStudy,export:exportVelocityReleaseStudy,propose:proposeVelocityReleases,
  question:'Which permitted release could separate the skew alternative from both loss-only fits?',
  introduction:'All three training-fitted velocity laws predict motion from rest at every explicitly permitted angle pair. Every fitted response law is retained, including those ranked lower on training.',
  objective:'For each response law, compare the skew alternative with each loss-only fit over the common output times. Rank a release by its smallest pairwise peak separation. The peaks may occur at different times: this proposes a whole sampled observation course, not one simultaneously separating reading.',
  initialSource:'Uses the current response notebook and original velocity training source.',sourceKind:'velocity',familyKind:'velocity',
  plotLabel:'Sampled angle separation of the skew alternative from each loss-only fit under every response law',
  courseDescription:'skew alternative versus each loss-only fit under every response law',
  familyChoice:'Velocity hypothesis for the motion experiment',familyPrompt:'Choose a fitted velocity hypothesis',
  familyNames:names,copyNames:names,
  adoption:'Choose a velocity hypothesis explicitly. Copying fills its fitted M, D and G, initial state and numerical settings; review the motion declaration before running. No law is identified by this choice.',
  unsupported:'All three velocity families and an executable response are required. Unsupported training is retained; no release is proposed.',
  noAdoption:'No velocity family is selected automatically.',filename:'worldlaw-velocity-release.json',
  qualification:'The notebook permits quasi-static positions; dynamic reachability, safety and observability remain unestablished. All fitted M, D and G may differ, so separating the complete fitted explanations does not uniquely diagnose G or its cause. Leaving observed ranges and every numerical failure remain visible. Sampled peaks and two-step agreement are not continuous-time maxima or error bounds. Separate observations never choose this proposal.',
  comparisons:release=>release.comparisons.map((c,i)=>({...c,a:c.baseline,b:c.skew,colorIndex:Math.floor(i/2),dash:c.baselineFamily==='diagonal'?'8 4':'',traceId:c.modelId+'-'+c.baselineFamily,label:c.label+' · skew vs '+names[c.baselineFamily]})),
  motionInput(parameters,position,settings,family){
   const input=velocityReleaseDynamicsInputs(parameters,position,settings);
   if(family!=='skew'){
    delete input.velocitySkew;delete input.units.velocitySkew;
    input.schema=LOSS_INPUT_SCHEMA;input.interpretation=LOSS_INTERPRETATION;
    if(family==='diagonal'){input.schema=MATRIX_INPUT_SCHEMA;input.interpretation=MATRIX_INTERPRETATION;delete input.dampingCross;}
   }
   return readDynamicsInputs(input);
  }
 });
}
