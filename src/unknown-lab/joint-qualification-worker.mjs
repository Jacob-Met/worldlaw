import {qualifyOfferedPlans,selectedJointDrift} from './joint-qualification.mjs';
self.onmessage=({data})=>{try{self.postMessage({ok:true,result:data.action==='select'?selectedJointDrift(data.inputs,data.ids):qualifyOfferedPlans(data.inputs)});}catch(e){self.postMessage({ok:false,error:e.message});}};
