import {mountReleasePanel} from './release-panel.mjs';
import {RELEASE_SCHEMA,readViscousReleaseStudy,exportViscousReleaseStudy,proposeViscousReleases,releaseDynamicsInputs} from './viscous-release.mjs';
import {MATRIX_INPUT_SCHEMA,MATRIX_INTERPRETATION} from './dynamics.mjs';

export function mountViscousReleases(root,options){
 return mountReleasePanel(root,options,{
  prefix:'release',key:'viscous',schema:RELEASE_SCHEMA,
  read:readViscousReleaseStudy,export:exportViscousReleaseStudy,propose:proposeViscousReleases,
  question:'Which permitted release could separate these loss hypotheses?',
  introduction:'Both loss fits predict motion from rest at each explicitly permitted angle pair. The proposal keeps every fitted response law, including those ranked lower on training.',
  objective:'For each response law, measure the largest predicted angle separation over the common output times. Rank a release by its smallest such separation across all response laws. This proposes a whole observation course; it does not identify a loss family or an optimal single reading time.',
  initialSource:'Uses the current response notebook and original viscous training source.',sourceKind:'viscous',familyKind:'loss',
  plotLabel:'Predicted separation between the loss hypotheses for each response law',
  courseDescription:'the two loss hypotheses under each response law',
  familyChoice:'Loss hypothesis for the motion experiment',familyPrompt:'Choose a fitted loss hypothesis',
  familyNames:{diagonal:'Independent loss',symmetric:'Symmetric cross loss'},copyNames:{diagonal:'Independent loss',symmetric:'Symmetric loss'},
  adoption:'Choose a loss hypothesis explicitly. Copying fills the initial state, fitted numerical values and common simulation settings; review the motion declaration before running.',
  unsupported:'Both loss families and an executable response are required. Unsupported training is retained; no release is proposed.',
  noAdoption:'Neither loss family is selected automatically.',filename:'worldlaw-viscous-release.json',
  qualification:'The notebook permits quasi-static positions. Dynamic reachability, safety and observability are unestablished. Every trajectory is conditional on its response law and training-fitted loss. Leaving observed position ranges is reported. Step agreement is not an error bound; both runs can miss behavior between retained times. Separate observations never choose this proposal.',
  comparisons:release=>release.comparisons.map(c=>({...c,a:c.diagonal,b:c.symmetric})),
  motionInput(parameters,position,settings,family){const input=releaseDynamicsInputs(parameters,position,settings);if(family==='diagonal'){input.schema=MATRIX_INPUT_SCHEMA;input.interpretation=MATRIX_INTERPRETATION;delete input.dampingCross;}return input;}
 });
}
