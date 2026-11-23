import {recommendActiveFollowup,createActiveNotebook,replayActiveNotebook,receiveActiveNotebook} from '../science/active-experiment-record.mjs';
import {coupledDemoReadings} from './instrument.mjs';
import {adaptiveTrackReadings} from './adaptive-instrument.mjs';

self.addEventListener('message',async event=>{
  const {id,action,sourceText,plan,book,text,profile}=event.data??{};
  try{
    let result;
    if(action==='plan')result=await createActiveNotebook(sourceText,{plan:plan??null,design:event.data.design});
    else if(action==='recommend')result=await recommendActiveFollowup(book,event.data.readingIndex);
    else if(action==='open')result=await replayActiveNotebook(text);
    else if(action==='read')result=await receiveActiveNotebook(book,text);
    else if(action==='adaptive-demo'){
      const verified=await replayActiveNotebook(book);
      result=await receiveActiveNotebook(verified,JSON.stringify(adaptiveTrackReadings(verified),null,2)+'\n');
    }
    else if(action==='demo'){
      const verified=await replayActiveNotebook(book);
      result=await receiveActiveNotebook(verified,JSON.stringify(coupledDemoReadings(verified.plan,profile),null,2)+'\n');
    }else throw Error('Unknown experiment operation.');
    self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:error?.message||String(error)});}
});
