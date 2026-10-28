import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createNotebook,calibrateNotebook,upsertMeasurement,deriveAngles} from '../../src/motion/measurement.mjs';
// Exploratory authored sensor: uniform illumination, fixed front-facing projection,
// complete support, identical normalized PSF with zero first moment at every time.
// By linearity its integrated image centroid equals the mean projected coordinates.
// No claim that maintained normalized-cross-correlation tracking reports centroids.
const p=JSON.parse(await readFile(new URL('./protocol.json',import.meta.url)));
assert.deepEqual([p.exposure.start,p.exposure.end,p.exposure.timestamp],[0,1,.5]);
const radius=p.projection.radius,pivot=p.projection.pivot;
function simpson(fn,n){let sum=fn(0)+fn(1);for(let i=1;i<n;i++)sum+=(i%2?4:2)*fn(i/n);return sum/(3*n);}
function receive(point){let nb=createNotebook({source:{kind:'synthetic',label:'Authored ideal integrated marker centroid; no tracker execution',width:512,height:512,duration:1}});nb=calibrateNotebook(nb,{pivot,zeroAngle:0,direction:1,pixelSigma:0});nb=upsertMeasurement(nb,{time:.5,timeBasis:'synthetic-time',status:'manual',point,reason:'Declared analytic ideal centroid, not an image-tracker output'});const before=JSON.stringify(nb),r=deriveAngles(nb);assert.equal(JSON.stringify(nb),before);return r.samples[0];}
assert.deepEqual(p.trajectories,[{kind:'constant-rate',offset:.4,rate:.8,center:.5},...[1.8,2.4,3].map(amplitude=>({kind:'quadratic',amplitude})),{kind:'complete-turn',rate:'2*pi'}]);
const cases=[{name:'constant angular rate symmetric about mean',q:t=>.4+.8*(t-.5),scalarMean:.4},...[1.8,2.4,3].map(a=>({name:'accelerating angle quadratic '+a,q:t=>a*t*t,scalarMean:a/3})),{name:'complete uniform turn',q:t=>2*Math.PI*t,scalarMean:Math.PI}];
const results=[];
for(const c of cases){const grids=[];for(const n of p.temporalSimpsonIntervals){const meanSin=simpson(t=>Math.sin(c.q(t)),n),meanCos=simpson(t=>Math.cos(c.q(t)),n),point={x:pivot.x+radius*meanSin,y:pivot.y+radius*meanCos};const received=receive(point);grids.push({integrationIntervals:n,meanSin,meanCos,point,scalarAngleAverage:c.scalarMean,centroidRadius:radius*Math.hypot(meanSin,meanCos),received,difference:received.position===null?null:received.position-c.scalarMean});}results.push({name:c.name,grids});}
assert.ok(Math.abs(results[0].grids[1].difference)<1e-13);
const expectedRadius=radius*Math.sin(.4)/.4;assert.ok(Math.abs(results[0].grids[1].centroidRadius-expectedRadius)<1e-11);
for(const r of results.slice(1,4)){assert.ok(Math.abs(r.grids[1].difference)>.01);assert.ok(Math.abs(r.grids[0].received.position-r.grids[1].received.position)<1e-9);}
assert.equal(results.at(-1).grids[1].received.position,null);assert.equal(results.at(-1).grids[1].received.reason,'marker_too_close_to_pivot');
const receipt={scope:'Exploratory ideal optical centroid probe, no real metadata, raster decoding or tracker execution',exposure:{start:0,end:1,reportedTime:.5,weight:'uniform',origin:'explicit authored declaration, not cadence-derived'},geometry:{projection:'front-facing circular marker path',radius,pivot,pointFormula:'x=px+R sin(q); y=py+R cos(q)'},assumptions:['Constant total brightness','Same complete zero-mean PSF at every time','No clipping, occlusion, background or perspective','Ideal full-image first-moment estimator declared separately from existing tracker'],cases:results,interpretation:'atan2(mean sin q,mean cos q) can differ from mean q. Existing Motion conversion faithfully reads supplied centroid coordinates; no claim its tracker supplies such coordinates.'};
assert.deepEqual(receipt,JSON.parse(await readFile(new URL('./probe-results.json',import.meta.url))));console.log('PASS complete frozen optical probe replay; no files written');console.log(JSON.stringify(results.map(r=>({name:r.name,...Object.fromEntries(['centroidRadius','scalarAngleAverage','difference'].map(k=>[k,r.grids[1][k]])),receivedAngle:r.grids[1].received.position})),null,2));
