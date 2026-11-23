import {isGuidedPlan,BINARY_PLAN,CASE_TWELVE_PLAN,ONE_FEEDBACK_PLAN,SUFFIX_PLAN,driftFeedbackInconclusive,pendingDriftSteps,fixedDriftRuns} from '../science/active-guided-drift.mjs';
import {escapeHTML as html} from './view.mjs';

const byId=id=>document.getElementById(id);
function table(caption,head,rows){
  return '<table><caption>'+html(caption)+'</caption><thead><tr>'+head.map(c=>'<th scope="col">'+html(c)+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+html(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function guidedProof(p){
  if(p.schema===SUFFIX_PLAN){
    if(p.status==='suffix-refuted')return {heading:'One measured prefix defeats every offered suffix.',
      summary:'The shared prefix is '+p.collision.prefixReadings.join(', ')+'. For each suffix, two laws fit the same complete record.',
      proof:table('Each alternative has its own later measurements.',['Suffix','Compatible laws','Remaining positions'],
        p.collision.branches.map(b=>[p.suffixes[b.suffix].join(' → '),b.worlds.map(w=>w.law).join(', '),b.readings.slice(p.prefix.length+1).join(', ')]))};
    if(p.polygons)return {heading:'Two measured contrasts choose the suffix.',
      summary:'Apply '+p.prefix.join(' → ')+'. Subtract the line through the first two measured positions from the next two. The resulting point determines the safe suffix.',
      proof:table('Closed regions where a complete suffix can retain a pair of laws.',['Suffix','Compatible laws','Polygon vertices'],
        p.polygons.flatMap((pairs,i)=>pairs.map(q=>[p.suffixes[i].join(' → '),q.laws.join(' / '),q.vertices.map(v=>'('+v.join(', ')+')').join(', ')])))};
    if(p.regions)return {heading:'The measured second difference chooses the suffix.',
      summary:'Apply '+p.prefix.join(' → ')+'. Compute the last prefix position minus twice the middle position plus the starting position.',
      proof:table('Decision regions include separate rows for exact endpoints.',['Second difference','Suffix'],
        p.regions.map(r=>[r.lo===r.hi?r.lo:'('+r.lo+', '+r.hi+')',p.suffixes[r.suffix].join(' → ')]))};
    if(p.status==='cover-budget-exhausted')return {heading:'The common-history search reached its budget.',
      summary:'The remaining groups have no verdict. The search used '+p.work.subsets+' group visits and '+p.work.linearWork+' linear-work units.',
      proof:''};
    if(p.status==='cover-inconclusive')return {heading:'The suffix cover is inconclusive.',
      summary:'A group of pairwise-compatible laws has a collision on each offered tape. Those collisions can require different prefix readings.',
      proof:table('Uncovered laws: '+p.uncovered.laws.join(', '),['Suffix','Colliding pair'],
        p.uncovered.failures.map(f=>[p.suffixes[f.suffix].join(' → '),f.collision.laws.join(' / ')]))};
    return {heading:'Choose a command sequence from the prefix readings.',
      summary:'Apply '+p.prefix.join(' → ')+'. The remaining laws determine the entire suffix before its first command.',
      proof:(p.eliminations?.length?table('These laws cannot share one prefix reading history.',
        ['Incompatible group','Positive inequality weights'],p.eliminations.map(e=>[e.excluded.join(', '),e.proof.map(term=>term[1]).join(', ')])):'')+
        table('Each group has a suffix that separates every pair.', ['Compatible group','Suffix'],
        p.cover.map(r=>[r.laws.join(', '),p.suffixes[r.suffix].join(' → ')]))};
  }
  if(p.schema===ONE_FEEDBACK_PLAN){
    const won=p.status==='one-feedback-certified',refuted=p.status==='all-declared-prefixes-refuted';
    const trials=table('Declared fixed prefixes in search order.',['Command prefix','Result'],p.trials.map(t=>[
      t.prefix.join(' → ')||'Initial reading only',t.collision?'Common history found':won?'Every last-action assignment excluded':'Budget reached']));
    const collisions=p.trials.filter(t=>t.collision).map(t=>table('Shared readings: '+t.collision.readings.join(', '),
      ['Final command','Possible final reading','Compatible laws'],t.collision.branches.map(b=>[
        b.command,b.finalReading,b.worlds.map(w=>w.law).join(' / ')]))).join('');
    return {heading:won?'A single feedback decision identifies the law.':refuted?'Every declared prefix admits a collision.':'The stated search budget was reached.',
      summary:won?'Apply '+p.prefix.length+' fixed pulses. The retained positions determine which last command separates all remaining laws.':
        refuted?'Each recorded history is compatible with two laws after every offered last command.':
        'The remaining assignments have no conclusion. Work used: '+p.work.assignments+' assignments and '+p.work.linearWork+' linear-work units.',
      proof:trials+collisions};
  }
  if(p.schema===CASE_TWELVE_PLAN)return {
    heading:'Identify the law in six pulses.',
    summary:'Five fixed pulses determine which command to apply last. Every fixed tape needs at least seven pulses.',
    proof:table('Apply these five commands in order. Record the initial position and one reading after each pulse.',
      ['Pulse','Command'],p.prefix.map((command,i)=>[String(i+1),command]))+
      table('The frozen sixth command depends on the laws compatible with the first six readings.',
        ['After pulse five','Sixth command'],[['L2 remains possible',p.prefix.at(-1)],['Only L0 or L1 remains possible','u2']])};
  const runs=fixedDriftRuns(p);
  const proof=table('Read the starting position and the position at the end of each command run.',
    ['Command','Pulses'],runs.map(r=>[r.command,r.repeats]));
  if(p.schema===BINARY_PLAN)return {heading:'The two laws require '+p.minimumPulses+' pulses.',
    summary:'The preceding horizon reaches distance '+p.previousDistance+'. This schedule reaches '+p.optimalDistance+
      ', strictly above the collision threshold '+p.collisionThreshold+'.',proof};
  return {heading:p.adaptiveLower===p.adaptiveUpper?'The catalog requires '+p.adaptiveUpper+' pulses.':
      'The adaptive minimum is between '+p.adaptiveLower+' and '+p.adaptiveUpper+' pulses.',
    summary:'The fixed-tape minimum is '+(p.fixedLower===p.fixedUpper?p.fixedUpper:'between '+p.fixedLower+' and '+p.fixedUpper)+
      ' pulses. The displayed fixed tape separates every pair.',
    proof:proof+table('Binary lower bounds on the multiclass experiment.',['Pair','Minimum pulses'],
      p.binaryBounds.map(row=>[row.laws.join(' / '),row.minimumPulses]))};
}

export function renderDriftNotebook(book,index,mode,dirty){
  const p=book.plan,guided=isGuidedPlan(p)&&p.status!=='indistinguishable';
  const finite=guided||p.status==='finite-schedule',frozen=mode==='frozen';
  const guidedView=guided?guidedProof(p):null;
  const latest=book.readouts.at(-1)?.result,pending=guided?pendingDriftSteps(p,latest):[];
  const witnesses=p.witnesses??(p.witness?[p.witness]:[]);
  const row=book.readouts[index], result=row?.result;
  byId('phase').textContent=dirty?'Unapplied source edits':frozen?'Frozen experiment':'Prospective preview';
  byId('source-kind').textContent='Persistent position and drift';
  byId('plan-kicker').textContent=frozen?'FROZEN PLAN':'PROSPECTIVE PREVIEW';
  byId('plan-heading').textContent=guided?guidedView.heading:finite?'A fixed schedule separates the offered laws.':'Some laws can share every position reading.';
  byId('plan-summary').textContent=guided?guidedView.summary:finite?p.pulseUpperBound+' pulses suffice at the declared error bound of ±'+p.source.noiseBound+
    '. The shortest possible schedule is unknown.':'A constant change in drift makes the listed pairs follow the same trajectory at every horizon.';
  byId('reading-timeline').replaceChildren();
  byId('drift-proof-heading').textContent=finite?'Schedule and separation proof':'Indistinguishable laws';
  byId('drift-proof').innerHTML=guided?guidedView.proof:finite?
    table('Apply each command for the indicated number of pulses; read each shared boundary once.',
      ['First command','Second command','Pulses per command','Read at ticks'],
      p.schedule.map(b=>[b.first,b.second,b.repeats,b.ticks.join(', ')]))+
    table('For each pair, the contrast is the first reading minus twice the middle reading plus the last reading.',
      ['Laws','Block','First interval','Second interval','Separation margin'],
      p.pairCertificates.map(c=>[c.laws.join(' / '),String(c.block+1),c.intervals[0].join(' to '),c.intervals[1].join(' to '),c.margin])):
    table('From the same starting position, shifting the second law’s drift by this amount preserves each commanded increment.',
      ['First law','Second law','Drift shift'],witnesses.map(w=>[...w.laws,w.driftShift]));
  byId('drift-gauge-controls').hidden=finite;
  if(!finite){
    const pair=byId('drift-pair'),prev=pair.value;
    pair.replaceChildren(...witnesses.map((w,i)=>new Option(w.laws.join(' / '),String(i))));
    if([...pair.options].some(o=>o.value===prev))pair.value=prev;
    byId('drift-commands').textContent='Commands: '+p.source.commands.join(', ')+'.';
    if(byId('drift-word').dataset.source!==p.sourceSHA256){
      byId('drift-word').dataset.source=p.sourceSHA256;
      byId('drift-word').value=p.source.commands.map(c=>c+' 1').join('\n');
      byId('drift-position').value='0';byId('drift-velocity').value='0';
    }
  }
  const receivable=finite&&!driftFeedbackInconclusive(p);
  byId('receive-region').hidden=!receivable;
  byId('supplied-details').hidden=!receivable;
  byId('receive-note').textContent=guided&&frozen?(pending.length?(pending[0].command?'Apply '+pending[0].command+' for '+pending[0].repeats+' pulse'+(pending[0].repeats==='1'?'':'s')+', then record tick '+pending[0].tick+'.':'Record the starting position at tick 0.'):'This recorded trajectory is complete or inconsistent.'):frozen?'Enter positions from a single run in checkpoint order.':'Freeze the schedule before entering readings.';
  byId('supplied-note').textContent=guided?'Append consecutive readings from the same run. Accepted readings remain in the notebook.':'Enter a consecutive prefix starting at tick 0. A compatible initial position and drift must explain the entire run.';
  byId('reading-fields').innerHTML=guided?pending.map(step=>'<label>'+html(step.command?
    step.command+' × '+step.repeats+' · position at tick '+step.tick:'Starting position at tick 0')+
    '<input id="drift-reading-'+html(step.tick)+'" data-tick="'+html(step.tick)+'" data-command="'+html(step.command??'')+'" type="text"></label>').join(''):finite?p.readAt.map((t,i)=>'<label>Position at tick '+html(t)+
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
  byId('reading-set').replaceChildren(...book.readouts.map((r,i)=>new Option((guided?'Through tick '+r.result.checked.ticks.at(-1)+' · packet ':finite?'Checkpoint set ':'Trace ')+(i+1),String(i))));
  byId('reading-set').value=String(index);
  byId('result-heading').textContent=finite?({'one_hypothesis_consistent':'One law fits the checkpoints.',
    'all_hypotheses_falsified':'No law fits the checkpoints.','multiple_hypotheses_consistent':'Several laws fit this prefix.'})[result.status]:
    'Both trajectories coincide.';
  byId('result-summary').textContent=finite?result.checked.ticks.length+' checkpoints received.':
    'Starting position '+result.trace.origin[0]+', with a drift shift of '+result.trace.driftShift+'.';
  if(finite){
    const checked=result.checked;
    byId('candidate-results').innerHTML=(guided?table('Retained measurements',['Tick','Applied command','Position'],
      checked.ticks.map((t,i)=>[t,i?checked.commands[i-1]:'Initial reading',checked.values[i]])):'')+table('Compatible initial states',['Law','Position witness','Drift witness'],
      checked.surviving.map(s=>[s.law,...s.initialWitness]));
    byId('missing-readings').textContent=checked.nextTick===null?'':guided?'Next command: '+checked.nextCommand+' · next reading at tick '+checked.nextTick+'.':'Next planned checkpoint: '+checked.nextTick+'.';
  }else{
    const trace=result.trace;
    byId('candidate-results').innerHTML=table('Positions after each command run',['Tick',...trace.laws],
      trace.ticks.map((t,i)=>[t,trace.readings[0][i],trace.readings[1][i]]));
    byId('missing-readings').textContent='';
  }
  byId('result-interpretation').textContent=finite?'Compatibility is conditional on the supplied model and error bound.':
    'The trace follows the two declared laws from their matching initial states.';
}
