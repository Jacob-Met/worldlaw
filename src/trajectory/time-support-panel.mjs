import {segmentAudit} from './segment-audit.mjs';
const element=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fmt=x=>Number.isFinite(x)?Number(x.toPrecision(6)).toString():'undefined';
export function createTimeSupportPanel(parent){
 const host=element('section');host.id='residual-time-support';host.hidden=true;
 host.append(element('style','#residual-time-support{border-top:2px solid #537c80;margin-top:24px;padding-top:16px;min-width:0}#residual-time-support[hidden]{display:none}#residual-time-support svg{display:block;width:100%;height:auto}#residual-time-support .support-scroll{overflow:auto;max-height:360px}#time-support-summary table{table-layout:fixed;width:100%;min-width:0}#time-support-summary th:first-child,#time-support-summary td:first-child{width:65%;white-space:normal;overflow-wrap:anywhere}'));
 host.append(element('h3','How does source-time support change the summary?'),element('p','Original row scores weight each receiving observation equally. Compare two explicitly assumed curves between observations: linear error, or linear squared error. Neither curve measures or bounds the unobserved motion. This comparison keeps every original observation and the same forecast.'));
 const inspect=element('button','Compare both interpolation assumptions');inspect.type='button';inspect.id='inspect-time-support';inspect.className='button outline';
 const status=element('p');status.id='time-support-status';status.setAttribute('role','status');
 const summary=element('div'),plot=element('div');summary.className='support-scroll';summary.id='time-support-summary';plot.id='time-support-plot';
 const label=element('label','Inspect an original adjacent source interval'),select=element('select');select.id='time-support-segment';label.append(select);
 const ledger=element('div');ledger.className='support-scroll';ledger.id='time-support-ledger';
 const interval=element('p');interval.id='time-support-interval';
 host.append(inspect,status,summary,label,plot,interval,ledger,element('p','The time integrals include the first interval from the imposed initial condition; the original row score still excludes that initial row once. Solid orange: squared linear-error curve. Dashed teal: linear squared-error curve. Their disagreement is sensitivity to these two assumptions, not an uncertainty interval. A sampled zero error does not exclude motion between readings. No physical energy, acceptance threshold or clock correction is inferred.'));
 parent.append(host);let rows=null,result=null;
 function clear(message){result=null;status.textContent=message;summary.replaceChildren();plot.replaceChildren();ledger.replaceChildren();select.replaceChildren();interval.textContent='';label.hidden=true;}
 function table(headers,values){const t=element('table'),head=element('tr');for(const h of headers)head.append(element('th',h));t.append(head);for(const row of values){const tr=element('tr');for(const x of row)tr.append(element('td',String(x)));t.append(tr);}return t;}
 function draw(){
  if(!result)return;const s=result.segments[Number(select.value)];plot.replaceChildren();ledger.replaceChildren();
  ledger.append(table(['Endpoint','Original row','Original time (s)','Observed (rad)','Frozen prediction (rad)','Error (rad)'],[['Earlier',s.earlier.index,s.earlier.time,s.earlier.observed,s.earlier.predicted,s.earlier.residual],['Later',s.later.index,s.later.time,s.later.observed,s.later.predicted,s.later.residual]]));
  interval.textContent=`Original interval ${s.earlier.index}→${s.later.index}: ${s.duration} s; ${fmt(s.spanFraction)} of the full time span. Contributions to full-span RMS (combined by sum of squares): linear error ${fmt(s.linearContributionRMS)} rad; linear squared error ${fmt(s.squaredContributionRMS)} rad; convention difference ${fmt(s.conventionDifferenceRMS)} rad.`;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','-60 0 640 260');svg.setAttribute('role','img');svg.setAttribute('aria-label','Two declared squared-error curves on one original adjacent source interval; no additional observations are invented.');
  const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);};
  const scale=Math.max(Math.abs(s.earlier.residual),Math.abs(s.later.residual))||1,a=s.earlier.residual/scale,b=s.later.residual/scale;
  const y=v=>210-170*v;
  add('line',{x1:70,x2:540,y1:210,y2:210,stroke:'#52636c'});
  add('path',{d:`M70 ${y(a*a)} Q305 ${y(a*b)} 540 ${y(b*b)}`,fill:'none',stroke:'#ad5525','stroke-width':3});
  add('line',{x1:70,y1:y(a*a),x2:540,y2:y(b*b),stroke:'#246b75','stroke-width':2,'stroke-dasharray':'7 5'});
  for(const[x,v]of [[70,a*a],[540,b*b]])add('circle',{cx:x,cy:y(v),r:4,fill:'#233f50'});
  for(const[text,x,yy,anchor]of [['Squared error / endpoint scale²',10,20,'start'],['Original adjacent interval (s)',540,250,'end'],['1',65,45,'end'],['0',65,210,'end'],[String(s.earlier.time),70,230,'start'],[String(s.later.time),540,230,'end']])add('text',{x,y:yy,'text-anchor':anchor,'font-size':12,fill:'#233f50'},text);
  plot.append(svg);
 }
 select.addEventListener('change',draw);
 inspect.addEventListener('click',()=>{clear('');try{
  result=segmentAudit(rows);status.textContent=`${result.segments.length}/${result.source.length-1} original adjacent intervals retained across ${result.span} s. Both declared conventions are shown; neither replaces the source-row score.`;
  summary.append(table(['Summary','RMS (rad)'],[['Original noninitial source rows',fmt(result.original.rmse)],['Assume linear error between readings',fmt(result.linearResidualRMS)],['Assume linear squared error between readings',fmt(result.linearSquaredResidualRMS)],['RMS scale of the conventions’ squared-integral difference',fmt(result.conventionDifferenceRMS)]]));
  for(const s of result.segments){const option=element('option',`Rows ${s.earlier.index}→${s.later.index}: ${s.earlier.time}–${s.later.time} s`);option.value=String(s.earlier.index);select.append(option);}label.hidden=false;draw();
 }catch(error){clear(error.message);}});
 return {render(source){clear('Compare assumptions explicitly; no time interpolation has been selected as truth.');host.hidden=!source;rows=source?source.map(r=>({time:r.time,observed:r.observed,predicted:r.predicted})):null;}};
}
