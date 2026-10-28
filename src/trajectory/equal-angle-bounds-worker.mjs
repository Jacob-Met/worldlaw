import {replayReturnBounds} from './equal-angle-bounds.mjs';
self.onmessage=event=>{try{self.postMessage({report:replayReturnBounds(event.data)});}catch(error){self.postMessage({error:error.message});}};
