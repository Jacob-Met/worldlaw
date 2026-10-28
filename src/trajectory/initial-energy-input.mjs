// Exact frozen-law and original supplied-state admission for the initial-box instrument.
import {rational,add,sub,cmp,enclosure,serial} from '../unknown-lab/chronos-exact-halfplanes.mjs';
const finite=(x,limit)=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=limit;
function insist(ok,message){if(!ok)throw Error(message);}
export function declaredBox(center,width){
 insist(finite(center,1e6)&&finite(width,100)&&width>=0,'Finite admitted center and width required');
 const c=rational(center),w=rational(width),exact=[sub(c,w),add(c,w)];
 const samples=[center-width,center,center+width];
 const low=samples.map(rational).reduce((a,b)=>cmp(a,b)<0?a:b,exact[0]);
 const high=samples.map(rational).reduce((a,b)=>cmp(a,b)>0?a:b,exact[1]);
 return {center,width,declared:exact.map(serial),sampled:samples,covered:[serial(low),serial(high)],outward:[enclosure(low).lower,enclosure(high).upper]};
}
export function prepareInvariantInput(model,initial,settings){
 insist(model?.schema==='worldlaw.angular-model/v1'&&model.scaleMeaning==='angular_acceleration_only_absolute_torque_unknown'&&model.physicalInertia===null&&model.absoluteTorqueIdentified===false,'Admit the maintained unknown-inertia angular model');
 const units={position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'};
 insist(model.units&&Object.keys(model.units).length===3&&Object.entries(units).every(([k,v])=>model.units[k]===v),'Exact angular units required');
 insist(Array.isArray(model.terms)&&model.terms.length===2&&new Set(model.terms.map(t=>t?.id)).size===2,'Exactly one rate and one gravity term required');
 const law={};
 for(const t of model.terms){insist(['rate','gravity'].includes(t?.id)&&finite(t.coefficient,1e18)&&t.coefficientUnit===({rate:'1/s',gravity:'rad/s²'})[t.id],'Unsupported term, coefficient or unit');law[t.id]=t.coefficient;}
 insist(law.rate<=0&&law.gravity<0,'Require nonnegative damping and positive restoring strength');
 insist(initial?.kind==='supplied-point-state','Prelude-derived state needs a separate explicit conditional contract');
 const box={position:declaredBox(initial.position,settings.positionHalfWidth),rate:declaredBox(initial.rate,settings.rateHalfWidth)};
 const source={modelId:model.id??null,runId:initial.runId??null,initialKind:initial.kind};
 const input={source,law,box,physicalInertia:null,absoluteTorqueIdentified:false};
 // Serialize only frozen law + initial declarations: no later samples, horizon or fit.
 return JSON.parse(JSON.stringify(input));
}
export function createRetirementGate(){
 let revision=0,accepted=null;
 return {retire(){revision++;accepted=null;return revision;},begin(){accepted=null;return ++revision;},commit(ticket,result){if(ticket!==revision)return false;accepted=structuredClone(result);return true;},get value(){return accepted===null?null:structuredClone(accepted);}};
}
