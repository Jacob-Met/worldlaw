const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
/** Read-only original-clock custody inside the existing affine instrument. */
export function renderClockTickWitness(parent,conversion){
 if(!conversion)return;
 const details=el('details');details.id='affine-clock-conversion';
 details.append(el('summary',`Original clock conversion · numerical rounding ≤ ${conversion.largestRoundingErrorSecondsUpper} s`));
 details.append(el('p','Original integer ticks were retained and origins subtracted exactly. These bounds describe number representation, not sensor uncertainty or measured clock calibration. The comparison uses representative seconds.'));
 const clockLabel=el('label','Original clock');clockLabel.htmlFor='tick-witness-clock';const clock=el('select');clock.id='tick-witness-clock';for(const name of ['state','torque']){const option=el('option',name==='state'?'State recorder':'Torque recorder');option.value=name;clock.append(option);}
 const rowLabel=el('label','Original row (starting at 1)');rowLabel.htmlFor='tick-witness-row';const row=el('input');row.id='tick-witness-row';row.type='number';row.min='1';row.step='1';row.value='1';row.style.maxWidth='160px';
 const pre=el('pre');pre.id='tick-witness-source';pre.style.cssText='max-width:100%;max-height:320px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';
 function show(){const source=conversion.clocks[clock.value],index=Number(row.value)-1;row.max=String(source.rows.length);if(!Number.isSafeInteger(index)||index<0||index>=source.rows.length){pre.textContent=`Choose an original row from 1 through ${source.rows.length}.`;return;}pre.textContent=JSON.stringify({originTicks:source.origin,ticksPerSecond:source.ticksPerSecond,...source.rows[index]},null,2);}
 clock.addEventListener('change',()=>{row.value='1';show();});row.addEventListener('input',show);show();details.append(clockLabel,clock,rowLabel,row,pre);parent.append(details);
}
