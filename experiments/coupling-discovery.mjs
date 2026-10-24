import {createCouplingCourse,observeVirtualCoupling} from '../src/coupling/virtual-instrument.mjs';
import {analyzeCouplingNotebook,addCouplingObservation} from '../src/coupling/notebook.mjs';
const courses=[];
for(const kind of ['reciprocal','independent','directional','collinear','nonlinear']){
  let notebook=createCouplingCourse(kind);const steps=[];
  for(let step=0;step<=4;step++){
    const result=analyzeCouplingNotebook(notebook),selected=result.discovery.selected;
    steps.push({step,selected:selected?.id??null,designRank:result.discovery.diagnostics.fullRank,
      adequacy:result.discovery.diagnostics.adequacy,separateCheckRmse:result.evaluations.find(x=>x.modelId===selected?.id)?.rmse??null,
      plan:{status:result.plan.status,input:result.plan.selected?.q??null,disagreement:result.plan.selected?.disagreement??null},
      matrix:selected?.matrix??null,bias:selected?.bias??null});
    if(step===4||!['proposed','needs_excitation'].includes(result.plan.status))break;
    const choice=result.plan.selected;
    notebook=addCouplingObservation(notebook,choice.index,observeVirtualCoupling(choice.q,{kind,index:1000+step}));
  }
  courses.push({kind,source:notebook.source,noiseSigma:notebook.options.noiseSigma,trainingRows:notebook.training.length,separateCheckRows:notebook.challenges.length,steps});
}
console.log(JSON.stringify({schema:'worldlaw.coupling-experiment/v1',evidenceKind:'authored_synthetic',node:process.version,
  scope:'Finite affine quasi-static response comparison; no physical validation or probability calibration.',courses},null,2));
