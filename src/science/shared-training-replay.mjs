import {checkSharedTrainingCertificate} from './shared-training-check.mjs';
export const SHARED_REPLAY_SCHEMA='worldlaw.shared-training-replay/v1';
const accepted=status=>['verified-interior-witness','verified-separation'].includes(status);
export function replaySharedTrainingCertificate(text){
 if(typeof text!=='string'||text.length>2000000)throw new Error('Certificate replay must be JSON text of at most 2,000,000 characters.');
 const bundle=JSON.parse(text),source=bundle?.source;
 if(bundle?.schema!==SHARED_REPLAY_SCHEMA||!source||source.schema!=='worldlaw.shared-training-source/v1'||!Array.isArray(source.training)||!Array.isArray(source.receiving)||!source.settings||typeof source.settings!=='object'||Array.isArray(source.settings))throw new Error('Malformed raw-source certificate replay.');
 const check=checkSharedTrainingCertificate(source.model,source.training,source.receiving,source.settings,bundle.certificate);
 if(!accepted(check.status))throw new Error(`Saved candidate did not pass the public checker: ${check.reason}.`);
 return {source,certificate:bundle.certificate,check};
}
export function serializeSharedTrainingCertificate(certificate){
 if(typeof certificate?.sourceKey!=='string')throw new Error('A source-bound certificate is required.');
 const text=JSON.stringify({schema:SHARED_REPLAY_SCHEMA,source:JSON.parse(certificate.sourceKey),certificate},null,2);
 replaySharedTrainingCertificate(text);
 return text;
}
