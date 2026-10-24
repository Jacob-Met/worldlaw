import {createStiffnessStudy} from '../src/stiffness/notebook.mjs';
import {stiffnessExample,exampleSettings} from '../src/stiffness/fixture.mjs';

const results=[];
for(const kind of ['kink','linear','smooth','narrow']){
 const s=createStiffnessStudy(stiffnessExample(kind),exampleSettings());
 results.push({kind,status:s.fit.status,adequacy:s.fit.diagnostics.adequacy,knot:s.fit.selected?.knot,
  settings:s.settings,trainingCount:s.dataset.observations.length,checkCount:s.dataset.heldOut.length,
  baselineTrainingRMSE:s.fit.baseline?.metrics.rmse,selectedTrainingRMSE:s.fit.selected?.metrics.rmse,
  checks:s.checks.filter(c=>c.knot===s.fit.selected?.knot||c.family==='global').map(({family,knot,rmse,extrapolationCount})=>({family,knot,rmse,extrapolationCount}))});
}
console.log(JSON.stringify({source:'independent repository-authored software controls; not physical measurements',results},null,2));
