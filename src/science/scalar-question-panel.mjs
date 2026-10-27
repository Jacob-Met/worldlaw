const el=(tag,text)=>{const x=document.createElement(tag);x.textContent=text;return x;};
export function renderScalarQuestion(host,state){
 const index=state.history.findLastIndex(h=>h.question);if(index<0)return;
 const q=state.history[index].question,received=state.history.find(h=>h.questionOutcome?.questionEvent===index-1)?.questionOutcome;
 const box=el('section','');box.id='scalar-question-receipt';box.append(el('h3','Frozen question and actual execution'),el('p',`Revision ${index}: command ${q.input.command} N·m; position ${q.input.position} rad; rate ${q.input.rate} rad/s. ${q.pairs.filter(p=>p.separable).length}/${q.pairs.length} model pairs separated under the original declared bounds.`));
 for(const x of q.intervals)box.append(el('p',`${x.id}: original prediction interval [${x.interval[0]}, ${x.interval[1]}] N·m.`));
 box.dataset.status=received?.status??(index===state.history.length-1?'pending':'retired');
 if(received){box.append(el('p',received.reason??received.qualification));for(const x of received.actualInputs.slice(0,16))box.append(el('p',`Actual command ${x.command} N·m; position ${x.position} rad; rate ${x.rate} rad/s.`));if(received.actualInputs.length>16)box.append(el('p',`First16of${received.actualInputs.length} actual states shown; no subset matched as the question.`));if(received.screen)box.append(el('p',`Original-question model screen: ${received.screen.status}. This conditional result is separate from refitting these outcomes.`));}
 else box.append(el('p',box.dataset.status==='pending'?'Pending: receive one actual reading at the exact selected state. No hardware command was sent.':'Retired by an intervening notebook revision; no later outcome is attributed to this question.'));
 host.append(box);
}
