import {investigateRateDissipation} from './rate-dissipation.mjs';
const element=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
const bounds=value=>value.lower===value.upper?String(value.lower):`[${value.lower}, ${value.upper}]`;
export function renderRateDissipation(container,model,trajectory){
  const group=element('section','');group.append(element('h4','Investigate speeds between the sampled solver states'));
  const label=element('label','Maximum absolute speed to inspect (rad/s) '),input=document.createElement('input');
  input.type='number';input.min='0';input.max='1000000';input.step='any';
  input.value=container.dataset.rateMaximum??String(Math.max(...trajectory.map(x=>Math.abs(x.rate))));label.append(input);
  const button=element('button','Inspect continuous speed interval');button.type='button';button.className='button button-dark';button.style.margin='10px 0';
  const result=element('div','No interval has been inspected.');result.setAttribute('role','status');
  group.append(label,button,result,element('p','The initial limit is the largest sampled speed in this prediction. You may declare another limit. This temporary query does not change or save the learned model; repeat it after reopening the notebook.'));
  button.addEventListener('click',()=>{
    result.replaceChildren();
    try{
      if(!input.value.trim())throw Error('Enter a maximum absolute speed.');
      const value=Number(input.value),analysis=investigateRateDissipation(model,value);container.dataset.rateMaximum=input.value;
      result.append(element('p',analysis.witness
        ? `Positive rate power exists inside |ω| ≤ ${value} rad/s, even if total sampled rate work is negative.`
        : `The supplied rate law has nonpositive power throughout |ω| ≤ ${value} rad/s.`));
      if(analysis.witness){
        const w=analysis.witness;result.append(element('p',`Witness speed enclosure: ${bounds(w.speed)} rad/s; power enclosure: ${bounds(w.power)} W.`));
        const details=element('details',''),exact=element('pre',JSON.stringify(w,null,2));exact.style.whiteSpace='pre-wrap';exact.style.overflowWrap='anywhere';details.append(element('summary','Inspect exact rational witness'),exact);result.append(details);
      }
      result.append(element('p',analysis.interpretation));
    }catch(error){result.append(element('p','Interval investigation refused: '+error.message));}
  });
  container.append(group);
}
