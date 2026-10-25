import {compareSaturationRates} from './saturation-profile.mjs';
import {freezeSaturationRateRequest,receiveSaturationRateAcquisition,exportSaturationRateAcquisition,importSaturationRateAcquisition} from './saturation-rate-acquisition.mjs';
import {authoredSaturationObservation} from './saturation-rate-fixture.mjs';
self.onmessage=({data:d})=>{try{
 let value;
 if(d.action==='compare')value=compareSaturationRates(d.study,d.settings);
 else if(d.action==='freeze')value=freezeSaturationRateRequest(d.study,d.settings,d.protocol);
 else if(d.action==='receive')value=receiveSaturationRateAcquisition(d.request,d.observation,d.study);
 else if(d.action==='authored'){if(d.request.protocol.source!=='synthetic')throw Error('Authored outcomes require an explicitly synthetic request.');value=receiveSaturationRateAcquisition(d.request,authoredSaturationObservation(d.request,d.scale),d.study);}
 else if(d.action==='export')value=exportSaturationRateAcquisition(d.request,d.observation??null);
 else if(d.action==='reopen'){const opened=importSaturationRateAcquisition(d.text);value={...opened,plan:opened.result?.plan??compareSaturationRates(opened.request.study,opened.request.settings)};}
 else throw Error('Unknown saturation acquisition action.');
 self.postMessage({value});
}catch(e){self.postMessage({error:e.message||String(e)});}};
