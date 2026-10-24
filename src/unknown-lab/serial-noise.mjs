import {serialCovariance} from './serial-covariance.mjs';
import { validateNotebook, evaluateHistory } from './paired-history.mjs';

// Conditional stationary AR(1) covariance, never estimated from the outcomes.
export function inspectSerialNoise(raw, rho) {
  if(typeof rho !== 'number' || !Number.isFinite(rho) || Math.abs(rho) > .999) throw Error('Declare correlation between -0.999 and 0.999.');
  const notebook=validateNotebook(raw), baseline=evaluateHistory(raw);
  if(baseline.order.status!=='counterbalanced') return {status:'unresolved-order',rho,baseline};
  const weights=notebook.pairs.flatMap(p=>{
    const n=p.reference.sampleIndex<p.conditioned.sampleIndex?baseline.order.referenceFirst:baseline.order.conditionedFirst;
    return [{sampleIndex:p.reference.sampleIndex,weight:-.5/n},{sampleIndex:p.conditioned.sampleIndex,weight:.5/n}];
  });
  const {variance,independentVariance}=serialCovariance(weights,rho,notebook.noiseSigma);
  const empiricalVariance=Math.max(0,baseline.standardError**2-independentVariance);
  const boundary=3*Math.sqrt(empiricalVariance+variance);
  return {status:'conditional',rho,baseline,weights,sensorVariance:variance,independentSensorVariance:independentVariance,empiricalVariance,boundary,
    interval:[baseline.decisionDifference-boundary,baseline.decisionDifference+boundary],
    verdict:Math.abs(baseline.decisionDifference)>boundary?'challenged':'inconclusive',
    interpretation:'Declared stationary sensor covariance per acquisition index; empirical scatter retained unchanged. Not fitted correlation, calibrated confidence, or physical history identification.'};
}
