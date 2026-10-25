import {analyzeSaturationProfile} from './saturation-profile.mjs';
self.onmessage=e=>{try{self.postMessage({result:analyzeSaturationProfile(e.data.study,e.data.settings)});}catch(error){self.postMessage({error:error.message||String(error)});}};
