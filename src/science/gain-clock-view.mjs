const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fmt=n=>Number(n.toPrecision(8)).toString();
export function renderGainClockExperiment(out,result){
 out.replaceChildren();const c=result.selected;
 out.append(el('h3','A command waveform to challenge the clock explanation'));
 out.append(el('p',`${result.candidates.length} complete offered profile/time pairs screened; ${result.candidates.filter(x=>x.withinBudget).length} meet full mapped-time support, amplitude and slew declarations.`));
 if(c){
  out.append(el('p',`Offer ${c.id}: ${c.profile.kind}${c.profile.cycles?` with ${c.profile.cycles} half cycles`:''}. Read torque at ${fmt(c.torqueTime)} torque-clock seconds. Cover at least ${fmt(c.costSeconds)} state-clock seconds. ${c.separated}/${c.pairs.length} family pairs separate after two declared reading radii.`));
  const lo=Math.min(...c.predictions.map(p=>p.interval[0]))-result.readingRadius,hi=Math.max(...c.predictions.map(p=>p.interval[1]))+result.readingRadius;
  for(const [i,p] of c.predictions.entries()){const row=el('div'),label=el('p',p.id),track=el('div'),bar=el('div');row.style.margin='12px 0';label.style.margin='0 0 4px';track.style.cssText='height:18px;position:relative;border-bottom:1px solid #aaa';track.setAttribute('role','img');track.setAttribute('aria-label',`${p.id} prediction range ${p.interval.map(fmt).join(' to ')} N·m`);bar.style.cssText=`position:absolute;height:12px;background:${i%2?'#a34c28':'#1c7562'};left:${100*(p.interval[0]-lo)/(hi-lo||1)}%;width:${Math.max(.15,100*(p.interval[1]-p.interval[0])/(hi-lo||1))}%`;track.append(bar);row.append(label,track);out.append(row);}
  for(const p of c.predictions)out.append(el('p',`${p.id}: [${p.interval.map(fmt).join(', ')}] N·m; mapped state-clock time [${p.stateTimeInterval.map(fmt).join(', ')}] s.`));
  out.append(el('p',`Acquire this offered profile independently. To compare its outcome, add received to the source JSON with candidateId ${JSON.stringify(c.id)}, jointTorque (N·m), and source (measurement provenance), then compare again. The received value does not select the experiment.`));
 }else out.append(el('p','No separation. Change the offered excitation or justify tighter declarations; no informative acquisition is claimed.'));
 if(result.received){const r=result.received;out.append(el('h3','Received outcome against the fixed prior families'),el('p',`${r.source} — ${r.candidateId}: ${fmt(r.jointTorque)} N·m.`),el('p',r.allPriorFailed?'All prior families excluded. A later coefficient refit may improve fit but does not validate either prior explanation.':`Not excluded: ${r.remaining.join(', ')}. This does not identify a unique physical defect.`));for(const o of r.outcomes)out.append(el('p',`${o.id}: ${o.excluded?'excluded':'not excluded'} against [${o.interval.map(fmt).join(', ')}] N·m and the declared reading radius.`));}
 for(const note of result.limitations)out.append(el('p',note));
}
