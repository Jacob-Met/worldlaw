import {inspectInputEnclosures} from './input-enclosure.mjs';
const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const fmt=n=>Number(n.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6});
export function renderInputEnclosures(host,model,observations){
 const controls=document.createElement('div'),fields={};
 for(const [key,label] of [['command','Command radius (N·m)'],['position','Angle radius (rad)'],['rate','Rate radius (rad/s)'],['jointTorque','Observed torque radius (N·m)']]){
  const wrap=node('label',label),input=document.createElement('input');input.type='number';input.min='0';input.max='1000000';input.step='any';input.value='0';input.dataset.radius=key;wrap.append(input);controls.append(wrap);fields[key]=input;
 }
 const refinement=document.createElement('select');refinement.dataset.refinement='segments';for(const value of [1,4,16,64,0]){const option=node('option',value?value+' joint position segment'+(value===1?'':'s'):'Independent terms only');option.value=String(value);refinement.append(option);}const refinementLabel=node('label','Position enclosure refinement');refinementLabel.append(refinement);controls.append(refinementLabel);
 const action=node('button','Check declared input bounds');action.type='button';
 const status=node('p','Declare absolute error radii before checking the inspected model. These are your assumptions, not inferred confidence.');
 status.setAttribute('role','status');const results=document.createElement('div');
 const clear=()=>{results.replaceChildren();status.textContent='Bounds changed. Check again to recompute.';};
 refinement.addEventListener('change',clear);
 for(const input of Object.values(fields))input.addEventListener('input',clear);
 host.replaceChildren(node('h3','Could input uncertainty explain this residual?'),controls,action,status,results,
  node('p','Not excluded means only that conservative intervals overlap. Terms sharing a coordinate may produce a much wider enclosure than any achievable prediction. No physical explanation or calibrated probability is established. Fixed coefficients and training observations are reused; bounds do not refit the law. Controls reset when the inspected model or evidence changes; the ordinary notebook does not save these radii.'));
 action.addEventListener('click',()=>{
  results.replaceChildren();
  try{
   const radii=Object.fromEntries(Object.entries(fields).map(([k,input])=>[k,input.value.trim()===''?NaN:Number(input.value)]));
   const report=inspectInputEnclosures(model,observations,radii,{refinementSegments:Number(refinement.value)});
   status.textContent=report.excludedCount+' of '+report.count+' readings excluded by the declared boxes; '+(report.count-report.excludedCount)+' not excluded. Coefficients remain fixed.';
   status.textContent+=' '+(report.refinement.status==='work-limit'?'Complete refinement needs '+report.refinement.requestedRowSegments+' row-segments, above '+report.refinement.limit+'; all rows retain independent-term bounds.':report.refinement.status==='joint-position'?'Joint position enclosure applied to '+report.refinement.refinedCount+' rows using '+report.refinement.usedSegments+' segment(s) each.':'Independent-term bounds retained; no shared-position refinement required or requested.');
   const list=document.createElement('ol');
   for(const row of report.rows.slice(0,20))list.append(node('li','Row '+(row.index+1)+': prediction ['+fmt(row.prediction[0])+', '+fmt(row.prediction[1])+'] N·m; observation ['+fmt(row.observation[0])+', '+fmt(row.observation[1])+'] N·m — '+row.status+'. Independent-term prediction ['+fmt(row.independentPrediction[0])+', '+fmt(row.independentPrediction[1])+'] N·m.'));
   results.append(list);
   if(report.count>20)results.append(node('p','First 20 rows displayed; totals include all '+report.count+' admitted readings.'));
   results.append(node('p','Arithmetic uses outward rounding and an explicit sine numerical allowance. This is an engineering enclosure, not a formally certified transcendental proof. Sign changes at zero are retained; zero radius at zero uses sign(0)=0.'));
  }catch(error){status.textContent='Not computed: '+error.message;}
 });
}
