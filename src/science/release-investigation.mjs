import {investigateReleaseDirections} from './release-directions.mjs';
import {investigateReleaseAmplitudes} from './release-amplitudes.mjs';
import {investigateReleasePeaks} from './release-peak-resolution.mjs';
import {exportSession} from '../session.mjs';
import {restoreNotebook} from '../notebook-input.mjs';
import {compareReleasePerturbations} from './release-perturbations.mjs';
import {screenReleaseResolution} from './release-resolution.mjs';
import {screenReleaseDiscretization} from './release-discretization.mjs';
import {outputIntervalCount} from './output-grid.mjs';
export const RELEASE_INVESTIGATION_SCHEMA='worldlaw.release-investigation/v1';
export const STEP_RELEASE_INVESTIGATION_SCHEMA='worldlaw.release-investigation/v2';
export const PEAK_RELEASE_INVESTIGATION_SCHEMA='worldlaw.release-investigation/v3';
export const AMPLITUDE_RELEASE_INVESTIGATION_SCHEMA='worldlaw.release-investigation/v4';
export const DIRECTION_RELEASE_INVESTIGATION_SCHEMA='worldlaw.release-investigation/v5';
export const MAX_RELEASE_FILE_BYTES=6000000;
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const keys=(x,allowed,label)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(x,k)))throw Error('Invalid '+label+' fields; only original inputs are accepted.');};
async function digest(x){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(x))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function question(raw,refinement=null){
 const stepMode=refinement!==null,peakMode=refinement==='peak-grids',amplitudeMode=refinement==='release-magnitudes',directionMode=refinement==='release-directions';
 keys(raw,['initial','settings','displacement','scales','screen','allowance','eventIndex',...(stepMode?['refinement']:[]),...(peakMode?['levels']:[]),...(amplitudeMode?['shrinkFactor']:[])],'release question');
 for(const k of ['initial','displacement'])keys(raw[k],['position','rate'],k);
 keys(raw.scales,['positionScale','rateScale'],'scales');
 keys(raw.settings,['duration','dt','inertia','command','relativeTolerance','positionTolerance','rateTolerance','maxTrials'],'settings');
 if(typeof raw.screen!=='boolean'||!Number.isFinite(raw.allowance)||raw.allowance<0||!(raw.eventIndex===null||Number.isInteger(raw.eventIndex)&&raw.eventIndex>=0))throw Error('Invalid release investigation options.');
 for(const obj of [raw.initial,raw.displacement,raw.scales,raw.settings])if(Object.values(obj).some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('Release inputs must be finite numbers.');
 if(stepMode&&(!['step-and-tolerances','peak-grids','release-magnitudes','release-directions'].includes(refinement)||raw.refinement!==refinement))throw Error('Unsupported numerical refinement method');
 if(peakMode&&(!Number.isInteger(raw.levels)||raw.levels<2||raw.levels>4))throw Error('Declare2–4 complete peak grids');
 if(directionMode&&raw.screen!==true)throw Error('A release-direction investigation must enable its comparison');
 if(amplitudeMode&&raw.screen!==true)throw Error('A release-magnitude investigation must enable its comparison');
 if(amplitudeMode&&![2,4,8].includes(raw.shrinkFactor))throw Error('Declare a shrink factor of 2, 4 or 8');
 const s=raw.settings;
 if(!(raw.scales.positionScale>0&&raw.scales.rateScale>0&&s.duration>0&&s.duration<=1000&&s.dt>0&&s.dt<=1&&s.inertia>0&&s.inertia<=1e12&&Math.abs(s.command)<=1e6&&Number.isSafeInteger(s.maxTrials)&&s.maxTrials>=1&&s.maxTrials<=100000&&outputIntervalCount(s.duration,s.dt)<=10000))throw Error('Release settings exceed supported limits.');
 for(const k of ['relativeTolerance','positionTolerance','rateTolerance'])if(s[k]<1e-14||s[k]>.01||raw.screen&&!stepMode&&s[k]===1e-14)throw Error('Declare supported distinct solver tolerances.');
 const norm=(q,v)=>Math.hypot(q/raw.scales.positionScale,v/raw.scales.rateScale);
 if(!(norm(raw.displacement.position,raw.displacement.rate)>0)||!Number.isFinite(norm(raw.displacement.position,raw.displacement.rate)))throw Error('Declare a resolved finite release change.');
 for(const sign of [-1,1]){const delta={};for(const k of ['position','rate']){const value=raw.initial[k]+sign*raw.displacement[k];if(Math.abs(raw.initial[k])>1e6||!Number.isFinite(value)||Math.abs(value)>1e6||raw.displacement[k]!==0&&value===raw.initial[k])throw Error('Release change is unresolved or outside the state envelope.');delta[k]=value-raw.initial[k];}const distance=norm(delta.position,delta.rate);if(!Number.isFinite(distance)||distance===0)throw Error('Executed release distance is unresolved.');}
 if(directionMode){const d={position:-(raw.displacement.rate/raw.scales.rateScale)*raw.scales.positionScale,rate:(raw.displacement.position/raw.scales.positionScale)*raw.scales.rateScale};if(!Number.isFinite(d.position)||!Number.isFinite(d.rate)||raw.displacement.rate!==0&&d.position===0||raw.displacement.position!==0&&d.rate===0)throw Error('Perpendicular release is unresolved');for(const sign of [-1,1]){const delta={};for(const key of ['position','rate']){const start=raw.initial[key]+sign*d[key];if(!Number.isFinite(start)||Math.abs(start)>1e6||d[key]!==0&&start===raw.initial[key])throw Error('Perpendicular release is unresolved or outside the state envelope');delta[key]=start-raw.initial[key];}const distance=norm(delta.position,delta.rate);if(!Number.isFinite(distance)||distance===0)throw Error('Perpendicular release distance is unresolved');}}
 if(amplitudeMode){for(const sign of [-1,1]){const delta={};for(const key of ['position','rate']){const d=raw.displacement[key]/raw.shrinkFactor;if(d*raw.shrinkFactor!==raw.displacement[key])throw Error('Reduced displacement is not representable');const start=raw.initial[key]+sign*d;if(!Number.isFinite(start)||d!==0&&start===raw.initial[key])throw Error('Reduced release is unresolved');delta[key]=start-raw.initial[key];}const distance=norm(delta.position,delta.rate);if(!Number.isFinite(distance)||distance===0)throw Error('Reduced release distance is unresolved');}}
 return structuredClone(raw);
}
function discoveryAt(state,eventIndex){if(eventIndex===null)return state.discovery;const receipt=state.history[eventIndex]?.experiment;if(!receipt?.models?.length)throw Error('Selected original law source does not exist in this notebook.');return {competitive:receipt.models};}
export async function saveReleaseInvestigation(state,raw){
 const stepMode=Object.hasOwn(raw,'refinement'),peakMode=raw.refinement==='peak-grids',amplitudeMode=raw.refinement==='release-magnitudes',directionMode=raw.refinement==='release-directions',q=question(raw,stepMode?raw.refinement:null),notebook=JSON.parse(exportSession(state));discoveryAt(state,q.eventIndex);
 const text=JSON.stringify({schema:directionMode?DIRECTION_RELEASE_INVESTIGATION_SCHEMA:amplitudeMode?AMPLITUDE_RELEASE_INVESTIGATION_SCHEMA:peakMode?PEAK_RELEASE_INVESTIGATION_SCHEMA:stepMode?STEP_RELEASE_INVESTIGATION_SCHEMA:RELEASE_INVESTIGATION_SCHEMA,notebook,sourceDigest:await digest(notebook),question:q},null,2);
 if(new TextEncoder().encode(text).length>MAX_RELEASE_FILE_BYTES)throw Error('Release investigation exceeds 6 MB.');return text;
}
export async function reopenReleaseInvestigation(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_RELEASE_FILE_BYTES)throw Error('Open a release investigation no larger than 6 MB.');
 const raw=JSON.parse(text);keys(raw,['schema','notebook','sourceDigest','question'],'release investigation');
 if(![RELEASE_INVESTIGATION_SCHEMA,STEP_RELEASE_INVESTIGATION_SCHEMA,PEAK_RELEASE_INVESTIGATION_SCHEMA,AMPLITUDE_RELEASE_INVESTIGATION_SCHEMA,DIRECTION_RELEASE_INVESTIGATION_SCHEMA].includes(raw.schema)||typeof raw.sourceDigest!=='string'||raw.sourceDigest!==await digest(raw.notebook))throw Error('Release investigation source fingerprint does not match.');
 const directionMode=raw.schema===DIRECTION_RELEASE_INVESTIGATION_SCHEMA,amplitudeMode=raw.schema===AMPLITUDE_RELEASE_INVESTIGATION_SCHEMA,peakMode=raw.schema===PEAK_RELEASE_INVESTIGATION_SCHEMA,stepMode=raw.schema!==RELEASE_INVESTIGATION_SCHEMA,q=question(raw.question,directionMode?'release-directions':amplitudeMode?'release-magnitudes':peakMode?'peak-grids':stepMode?'step-and-tolerances':null),state=restoreNotebook(JSON.stringify(raw.notebook));
 if(canonical(JSON.parse(exportSession(state)))!==canonical(raw.notebook))throw Error('Notebook contains unsupported, derived, or noncanonical source fields.');
 const discovery=discoveryAt(state,q.eventIndex);
 const screened=q.screen?(directionMode?investigateReleaseDirections(discovery,q.initial,q.displacement,q.settings,q.scales,{allowance:q.allowance}):amplitudeMode?investigateReleaseAmplitudes(discovery,q.initial,q.displacement,q.settings,q.scales,{shrinkFactor:q.shrinkFactor,allowance:q.allowance}):peakMode?investigateReleasePeaks(discovery,q.initial,q.displacement,q.settings,q.scales,{levels:q.levels,allowance:q.allowance}):(stepMode?screenReleaseDiscretization:screenReleaseResolution)(discovery,q.initial,q.displacement,q.settings,q.scales,q.allowance)):null;
 if(screened?.status==='work-limit')throw Error(directionMode?'The complete release-direction course exceeds its work or sample bound':peakMode?'The complete peak-grid course exceeds its work or sample bound':'The complete release-magnitude course exceeds its work or sample bound');
 const result=screened?((peakMode||amplitudeMode||directionMode)?screened.courses[0]:screened.original):compareReleasePerturbations(discovery,q.initial,q.displacement,q.settings,q.scales);
 return {state,question:q,screened,result};
}
