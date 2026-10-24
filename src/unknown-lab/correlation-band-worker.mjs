import {inspectCorrelationBand} from './correlation-band.mjs';
self.onmessage=event=>{const {id,inputs}=event.data;try{self.postMessage({id,report:inspectCorrelationBand(inputs)});}catch(error){self.postMessage({id,error:error.message});}};
