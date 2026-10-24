/** Authored response instrument, independent from model feature construction. */
import {SCHEMA} from './notebook.mjs';
const kinds=['reciprocal','independent','directional','nonlinear','collinear'];
export function observeVirtualCoupling(q,{kind='reciprocal',index=0}={}) {
  if(!kinds.includes(kind)||!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||Math.abs(v)>1)||!Number.isInteger(index)||index<0)throw new Error('Invalid virtual coupling acquisition.');
  const [a,b]=q;
  const coupled=kind!=='independent',crossB=kind==='directional'?-0.3:0.8;
  const n1=0.0006*Math.sin((index+1)*1.73),n2=0.0006*Math.cos((index+1)*2.31);
  return {id:`virtual-${kind}-${index}`,q:[a,b],torque:[-2*a+(coupled?0.8*b:0)+0.05+(kind==='nonlinear'?1.8*a*a*a:0)+n1,
    -1.4*b+(coupled?crossB*a:0)-0.04+(kind==='nonlinear'?1.5*b*b:0)+n2]};
}
export function createCouplingCourse(kind='reciprocal') {
  if(!kinds.includes(kind))throw new Error('Unknown virtual course.');
  const broad=kind==='nonlinear',training=Array.from({length:32},(_,i)=>{
    const a=(((i*7)%17)-8)*(broad?0.1:0.003),b=kind==='collinear'?a:(((i*11)%19)-9)*(broad?0.1:0.003);
    return observeVirtualCoupling([a,b],{kind,index:i});
  });
  const challenges=Array.from({length:25},(_,i)=>observeVirtualCoupling([[-.85,-.4,.05,.45,.8][i%5],[-.75,-.35,.07,.4,.9][Math.floor(i/5)]],{kind,index:100+i}));
  return {schema:SCHEMA,source:{kind:'synthetic',label:`Authored ${kind} response instrument`,reference:`worldlaw.coupling-virtual/v1/${kind}`},
    units:{position:'rad',torque:'N·m'},assumptions:{quasiStatic:true,coordinateConvention:'Two declared angular coordinates; both torque signs follow their own positive angle. No geometry inferred.'},
    options:{noiseSigma:0.025,ambiguityDelta:6},training,challenges,permitted:[-1,0,1].flatMap(a=>[-1,0,1].map(b=>[a,b])),revisions:[]};
}
