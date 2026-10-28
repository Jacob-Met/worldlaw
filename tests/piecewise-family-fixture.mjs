import{createSession,receiveScalarChallenge}from'../src/session.mjs';
import{UNITS}from'../src/data.mjs';
import{piecewiseCalibrationContext}from'../src/science/piecewise-calibration.mjs';
import{searchConditionedPiecewise}from'../src/science/piecewise-conditioned.mjs';
export const report={schema:'worldlaw.piecewise-calibration/v1',units:'N·m',piecewiseLinear:true,reportId:'three-original',instrumentId:'bridge',basis:'Explicit interpolation assumption',standards:[0,1,2].map((y,i)=>({id:'s'+i,reportedTorque:y,referenceTorque:[0,1.2,2][i],absoluteError:.1,basis:'Original calibration'}))};
const original=createSession({observations:[0,.25,.5,.75,1,1.25,1.5,1.75,2].map(x=>({command:x,position:x*x,rate:0,jointTorque:x<=1.2?x/1.2:1+(x-1.2)/.8}))},{maxTerms:2,ambiguityDelta:10});
export const makeState=y=>receiveScalarChallenge(original,[{command:1,position:.25,rate:0,jointTorque:y}],{label:'Original actual',units:UNITS});
export const checks={schema:'worldlaw.piecewise-calibration-check/v1',units:'N·m',reportId:'independent',independentChecks:true,sameInstrument:true,basis:'Independent check course',checks:[{id:'check',reportedTorque:.5,referenceTorque:.52,absoluteError:.005,basis:'Original check'}]};
