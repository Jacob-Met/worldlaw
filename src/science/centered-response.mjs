import {fitSoftL1Columns} from './robust-fit.mjs';
export function fitCenteredResponse(columns, readings, scale) {
 if (!Array.isArray(readings)||!readings.length||readings.length>4096||Array.from(readings).some(v=>!Number.isFinite(v)||Math.abs(v)>1e12)) throw Error('Finite bounded readings required');
 if (!Array.isArray(columns)||!columns.length||columns.length>9||Array.from(columns).some(c=>!Array.isArray(c)||c.length!==readings.length||Array.from(c).some(v=>!Number.isFinite(v)))) throw Error('Finite aligned columns required');
 if(!Array.from(columns).some(c=>c.every(v=>v===1)))return {status:'constant-column-required'};
 // A source reading near the training center avoids making a rare first-row outlier the numerical origin.
 const origin=[...readings].sort((a,b)=>a-b)[Math.floor(readings.length/2)],fit=fitSoftL1Columns(columns,readings.map(v=>v-origin),scale);
 if(fit.status!=='converged')return fit;
 return {schema:'worldlaw.centered-response-experiment/v1',status:'converged',origin,coefficients:[...fit.coefficients],fit};
}
export function centeredResponse(model, features, reading) {
 if(model?.schema!=='worldlaw.centered-response-experiment/v1'||model.status!=='converged'||!Number.isFinite(model.origin)||!Array.isArray(model.coefficients)||Array.from(model.coefficients).some(v=>!Number.isFinite(v))||!Array.isArray(features)||features.length!==model.coefficients.length||Array.from(features).some(v=>!Number.isFinite(v)))throw Error('Invalid centered response');
 const delta=features.reduce((s,v,i)=>s+v*model.coefficients[i],0),rounded=model.origin+delta;
 if(!Number.isFinite(delta)||!Number.isFinite(rounded))throw Error('Nonfinite response');
 if(reading!==undefined&&!Number.isFinite(reading))throw Error('Finite reading required');
 return {origin:model.origin,delta,rounded,...(reading===undefined?{}:{residual:(reading-model.origin)-delta,roundedResidual:reading-rounded})};
}
export function centeredResponseDerivative(model,derivatives){return centeredResponse({...model,origin:0},derivatives).delta;}
