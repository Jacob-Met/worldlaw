import {escapeHTML as html} from './view.mjs';

const byId=id=>document.getElementById(id);
function table(caption,head,rows){
  return '<table><caption>'+html(caption)+'</caption><thead><tr>'+head.map(c=>'<th scope="col">'+html(c)+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+html(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
export function renderDriftNotebook(book,index,mode,dirty){
  const p=book.plan, finite=p.status==='finite-schedule', frozen=mode==='frozen';
  const row=book.readouts[index], result=row?.result;
  byId('phase').textContent=dirty?'Unapplied source edits':frozen?'Frozen experiment':'Prospective preview';
  byId('source-kind').textContent='Persistent position and drift';
  byId('plan-kicker').textContent=frozen?'FROZEN PLAN':'PROSPECTIVE PREVIEW';
  byId('plan-heading').textContent=finite?'A fixed schedule separates the offered laws.':'Some laws can share every position reading.';
  byId('plan-summary').textContent=finite?p.pulseUpperBound+' pulses suffice at the declared error bound of ±'+p.source.noiseBound+
    '. The shortest possible schedule is unknown.':'A constant change in drift makes the listed pairs follow the same trajectory at every horizon.';
  byId('reading-timeline').replaceChildren();
  byId('drift-proof-heading').textContent=finite?'Schedule and separation proof':'Indistinguishable laws';
  byId('drift-proof').innerHTML=finite?
    table('Apply each command for the indicated number of pulses; read each shared boundary once.',
      ['First command','Second command','Pulses per command','Read at ticks'],
      p.schedule.map(b=>[b.first,b.second,b.repeats,b.ticks.join(', ')]))+
    table('For each pair, the contrast is the first reading minus twice the middle reading plus the last reading.',
      ['Laws','Block','First interval','Second interval','Separation margin'],
      p.pairCertificates.map(c=>[c.laws.join(' / '),String(c.block+1),c.intervals[0].join(' to '),c.intervals[1].join(' to '),c.margin])):
    table('From the same starting position, shifting the second law’s drift by this amount preserves each commanded increment.',
      ['First law','Second law','Drift shift'],p.witnesses.map(w=>[...w.laws,w.driftShift]));
  byId('drift-gauge-controls').hidden=finite;
  if(!finite){
    const pair=byId('drift-pair'),prev=pair.value;
    pair.replaceChildren(...p.witnesses.map((w,i)=>new Option(w.laws.join(' / '),String(i))));
    if([...pair.options].some(o=>o.value===prev))pair.value=prev;
    byId('drift-commands').textContent='Commands: '+p.source.commands.join(', ')+'.';
    if(byId('drift-word').dataset.source!==p.sourceSHA256){
      byId('drift-word').dataset.source=p.sourceSHA256;
      byId('drift-word').value=p.source.commands.map(c=>c+' 1').join('\n');
      byId('drift-position').value='0';byId('drift-velocity').value='0';
    }
  }
  byId('receive-region').hidden=!finite;
  byId('supplied-details').hidden=!finite;
  byId('receive-note').textContent=frozen?'Enter positions from a single run in checkpoint order.':'Freeze the schedule before entering readings.';
  byId('supplied-note').textContent='Enter a consecutive prefix starting at tick 0. A compatible initial position and drift must explain the entire run.';
  byId('reading-fields').innerHTML=finite?p.readAt.map((t,i)=>'<label>Position at tick '+html(t)+
    '<input id="drift-reading-'+i+'" data-tick="'+html(t)+'" type="text" inputmode="text"></label>').join(''):'';
  for(const id of ['adaptive-policy','control-course','joint-comparison','demo-controls','adaptive-controls','future-region'])
    byId(id).hidden=true;
  byId('source-description').textContent=p.source.laws.length+' laws on '+p.source.commands.length+' commands, with one unknown initial position and constant drift.';
  byId('source-digest').textContent=p.sourceSHA256;byId('plan-digest').textContent=p.planSHA256;
  byId('reading-digest').textContent=result?.readingsSHA256??'No input received';
  byId('custody-summary').textContent=book.readouts.length+' saved inputs. Reopening recalculates the plan and each result.';
  byId('certificate').textContent=JSON.stringify(p,null,2);byId('course-comparison').replaceChildren();
  byId('result-region').hidden=!row;
  if(!row)return;
  byId('result-region').dataset.status=result.status;
  byId('result-origin').textContent=finite?(result.acquisition==='synthetic'?'SYNTHETIC CHECKPOINTS':'SUPPLIED CHECKPOINTS'):'CALCULATED GAUGE TRACE';
  byId('reading-set').replaceChildren(...book.readouts.map((r,i)=>new Option((finite?'Checkpoint set ':'Trace ')+(i+1),String(i))));
  byId('reading-set').value=String(index);
  byId('result-heading').textContent=finite?({'one_hypothesis_consistent':'One law fits the checkpoints.',
    'all_hypotheses_falsified':'No law fits the checkpoints.','multiple_hypotheses_consistent':'Several laws fit this prefix.'})[result.status]:
    'Both trajectories coincide.';
  byId('result-summary').textContent=finite?result.checked.ticks.length+' checkpoints received.':
    'Starting position '+result.trace.origin[0]+', with a drift shift of '+result.trace.driftShift+'.';
  if(finite){
    const checked=result.checked;
    byId('candidate-results').innerHTML=table('Compatible initial states',['Law','Position witness','Drift witness'],
      checked.surviving.map(s=>[s.law,...s.initialWitness]));
    byId('missing-readings').textContent=checked.nextTick===null?'':'Next planned checkpoint: '+checked.nextTick+'.';
  }else{
    const trace=result.trace;
    byId('candidate-results').innerHTML=table('Positions after each command run',['Tick',...trace.laws],
      trace.ticks.map((t,i)=>[t,trace.readings[0][i],trace.readings[1][i]]));
    byId('missing-readings').textContent='';
  }
  byId('result-interpretation').textContent=finite?'Compatibility is conditional on the supplied model and error bound.':
    'The trace follows the two declared laws from their matching initial states.';
}
