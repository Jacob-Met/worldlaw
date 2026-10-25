import {analyzeSaturationProfile,screenSaturationChallenges} from './saturation-profile.mjs';
self.onmessage=e=>{
 try{
  // Freeze the complete training investigation before any joint challenge check.
  const result=analyzeSaturationProfile(e.data.study,e.data.settings);let joint;
  try{joint=screenSaturationChallenges(e.data.study,e.data.settings);}catch(error){joint={status:'unavailable',error:error.message||String(error)};}
  self.postMessage({result,joint});
 }catch(error){self.postMessage({error:error.message||String(error)});}
};
