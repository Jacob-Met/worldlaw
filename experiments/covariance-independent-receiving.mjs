import assert from 'node:assert/strict';
import {weakWindows} from '../src/trajectory/weak-operator.mjs';
import {comparePositionNoiseCovariance} from '../src/predictive-selection/covariance.mjs';
const insist=(x,m)=>assert.ok(x,m), terms=['rate','spring','gravity','cosine','cubic','bias'];
const runs=[0,1].map(n=>({id:'independent-'+n,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:0,source:{label:'independent analytic position',recordingId:'distinct-'+n},samples:Array.from({length:161},(_,i)=>{const t=i*.04+.0002*Math.sin(i*.7);return {time:t,position:(1+n*.3)*Math.exp(-.07*t)*Math.cos(2.3*t+n*.4)+.002*Math.sin(17*t+.2*n)};})}));
const options={terms,windowDuration:.8,windowStride:.28}, rows=weakWindows(runs[0],options,null,insist,{includePositionDerivatives:true});
let worst=0,count=0;
for(const index of [0,5,13,20,37,80,120]){
 const h=1e-6, plus=structuredClone(runs[0]),minus=structuredClone(runs[0]);plus.samples[index].position+=h;minus.samples[index].position-=h;
 const p=weakWindows(plus,options,null,insist),m=weakWindows(minus,options,null,insist);
 for(let i=0;i<rows.length;i++){const r=rows[i],k=index-r.firstIndex;if(k<0||index>r.lastIndex)continue;for(let j=-1;j<terms.length;j++){
 const fd=((j<0?p[i].target:p[i].columns[j])-(j<0?m[i].target:m[i].columns[j]))/(2*h),analytic=j<0?r.positionWeights[k]:r.featurePositionDerivatives[j][k];worst=Math.max(worst,Math.abs(fd-analytic));count++;assert.ok(Math.abs(fd-analytic)<2e-8);
 }}
}
// Independent dense covariance and Gaussian solve, intentionally no production band factor or QR.
const solve=(matrix,b)=>{const a=matrix.map((r,i)=>[...r,b[i]]),n=b.length;for(let k=0;k<n;k++){let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;[a[k],a[pivot]]=[a[pivot],a[k]];assert.ok(Math.abs(a[k][k])>1e-16);for(let i=k+1;i<n;i++){const q=a[i][k]/a[k][k];for(let j=k;j<=n;j++)a[i][j]-=q*a[k][j];}}const x=Array(n).fill(0);for(let i=n-1;i>=0;i--)x[i]=(a[i][n]-a[i].slice(i+1,n).reduce((s,v,j)=>s+v*x[i+1+j],0))/a[i][i];return x;};
const co=[-.12,-5],selected=['rate','spring'];let gram=[[0,0],[0,0]],rhs=[0,0];
for(const run of runs){const rs=weakWindows(run,{...options,terms:selected},null,insist,{includePositionDerivatives:true});const gs=rs.map(r=>Array.from({length:run.samples.length},(_,k)=>k<r.firstIndex||k>r.lastIndex?0:r.positionWeights[k-r.firstIndex]-co.reduce((s,c,j)=>s+c*r.featurePositionDerivatives[j][k-r.firstIndex],0)));const C=gs.map(a=>gs.map(b=>a.reduce((s,v,k)=>s+v*b[k],0)));const target=rs.map(r=>r.target),cols=selected.map((_,j)=>rs.map(r=>r.columns[j]));const ct=solve(C,target),cc=cols.map(col=>solve(C,col));for(let j=0;j<2;j++){rhs[j]+=cols[j].reduce((s,v,i)=>s+v*ct[i],0);for(let k=0;k<2;k++)gram[j][k]+=cols[j].reduce((s,v,i)=>s+v*cc[k][i],0);}}
const expected=solve(gram,rhs), model={schema:'worldlaw.angular-model/v1',id:'independent',physicalInertia:null,absoluteTorqueIdentified:false,scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},terms:selected.map((id,j)=>({id,coefficient:co[j],coefficientUnit:j?'1/s²':'1/s'}))};const receipt=comparePositionNoiseCovariance(model,runs,{windowDuration:.8,windowStride:.28,maxIterations:1});assert.equal(receipt.status,'iteration_limit');assert.equal(receipt.refinedModel,null);expected.forEach((v,j)=>assert.ok(Math.abs(v-receipt.iterations[0].coefficients[j])<1e-10));
console.log(JSON.stringify({finiteDifferenceChecks:count,worstDerivativeError:worst,denseGLS:expected,production:receipt.iterations[0].coefficients,status:receipt.status}));
