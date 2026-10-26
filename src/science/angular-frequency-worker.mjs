import {discoverAngularFrequency} from './angular-frequency.mjs';
self.onmessage=({data})=>{try{self.postMessage({result:discoverAngularFrequency(data.training,data.settings)});}catch(error){self.postMessage({error:error.message});}};
