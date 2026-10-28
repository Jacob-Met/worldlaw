import {prepareInvariantInput} from './initial-energy-input.mjs';
import {confineDampedSine} from './initial-energy.mjs';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
// Decimal endpoint is an exact directed projection of the raw dyadic bound.
export function formatEnergyBound(raw,upper,digits=5){
 const n=BigInt(raw),d=1n<<80n,scale=10n**BigInt(digits),v=n*scale;
 const floor=(a,b)=>a>=0n?a/b:-((-a+b-1n)/b);
 const q=upper?-floor(-v,d):floor(v,d),negative=q<0n,a=negative?-q:q;
 const text=a.toString().padStart(digits+1,'0');return (negative?'-':'')+text.slice(0,-digits)+'.'+text.slice(-digits);
}
export function createInitialEnergyControls(anchor,context){
 const host=node('section');host.id='initial-energy';host.style.cssText='border-left:3px solid #3b6978;padding:12px 16px;display:grid;gap:10px;background:#f3f7f6;min-width:0';
 const title=node('h3','Limits for every declared start');title.style.margin='0';
 const intro=node('p','Use the same angle and rate widths above to check a coarse all-time limit of the frozen damped-sine law. The sampled paths remain a separate calculation.');
 const button=node('button','Check all-time model limits');button.type='button';button.id='check-initial-energy';button.className='button outline';button.style.justifySelf='start';
 const status=node('p','No limit checked.');status.id='initial-energy-status';status.setAttribute('role','status');
 const output=node('div');output.id='initial-energy-output';output.hidden=true;
 host.append(title,intro,button,status,output);anchor.before(host);let ticket=0,busy=false;
 function clear(){ticket++;button.disabled=busy;output.replaceChildren();output.hidden=true;host.dataset.state='idle';status.textContent='Inputs changed. Check the current declared starts again.';}
 button.addEventListener('click',async()=>{
  if(busy)return;clear();const mine=ticket;button.disabled=true;status.textContent='Checking the complete declared starting box…';
  await new Promise(requestAnimationFrame);if(mine!==ticket)return;
  try{
   const c=context();if(c.prelude)throw Error('This check uses the original supplied starting rate. Turn off the prelude-derived rate to compare the same declared starting box.');
   if(!c.positionWidth.trim()||!c.rateWidth.trim())throw Error('Enter both declared half-widths above.');
   const input=prepareInvariantInput(c.model,{kind:'supplied-point-state',runId:c.run.id,position:c.run.samples[0].position,rate:c.run.initialRate},{positionHalfWidth:Number(c.positionWidth),rateHalfWidth:Number(c.rateWidth)});
   const result=confineDampedSine(input);if(mine!==ticket)return;
   host.dataset.state=result.status;
   if(result.status!=='confined'){status.textContent='No all-time limit established for this declared box. This does not establish escape or invalidate the separate sampled paths.';return;}
   status.textContent='Every declared starting state stays within these limits under this exact frozen model.';
   const table=node('table');table.style.cssText='width:100%;table-layout:fixed';
   for(const [label,key] of [['Angle (rad)','position'],['Rate (rad/s)','rate']]){
    const row=node('tr'),name=node('th',label),value=node('td',`${formatEnergyBound(result[key+'Raw'][0],false)} to ${formatEnergyBound(result[key+'Raw'][1],true)}`);name.scope='row';name.style.cssText='width:34%;white-space:normal;text-align:left;font-size:.8rem';value.style.cssText='white-space:normal;overflow-wrap:anywhere;font-size:.875rem';value.dataset.rawLower=result[key+'Raw'][0];value.dataset.rawUpper=result[key+'Raw'][1];row.append(name,value);table.append(row);
   }
   const note=node('p','These are coarse limits for all future time, not a prediction of phase, a confidence band or physical validation. The law and widths are assumed exact; physical inertia remains unknown. Displayed endpoints are rounded outwards.');
   const details=node('details'),summary=node('summary','Starting-box declarations');details.append(summary);
   for(const [name,b] of Object.entries(input.box))details.append(node('p',`${name==='position'?'Angle':'Rate'} center ${b.center}, half-width ${b.width}; includes both exact declarations and the rounded sampled starts.`));
   output.append(table,note,details);output.hidden=false;
  }catch(error){if(mine===ticket){host.dataset.state='unavailable';status.textContent='All-time check unavailable: '+error.message+'. The separate sampled paths remain available.';}}
  finally{if(mine===ticket)button.disabled=false;}
 });
 return {clear,setBusy(value){busy=!!value;if(busy)clear();button.disabled=busy;}};
}
