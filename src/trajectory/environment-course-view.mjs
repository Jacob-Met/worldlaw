/** Actual recorded and executable predicted motion; rendering never fits or selects. */
const NS='http://www.w3.org/2000/svg';
export const ENVIRONMENT_MODE_LABELS={pooled:'Pooled coefficients','shared-restoring':'Shared restoring coefficients',independent:'Independent conditions'};
const MODES=Object.entries(ENVIRONMENT_MODE_LABELS).map(([id,label],i)=>({id,label,color:['#175fc4','#ae4e13','#7935c7'][i],dash:['10 4','4 3','12 3 2 3'][i]}));
let sequence=0;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const svg=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=String(text);return n;};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const environmentFormat=x=>!finite(x)?'Unavailable':x===0?'0':Math.abs(x)<0.0001?x.toExponential(3):Number(x.toPrecision(5)).toString();
function domains(runs){
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,maxResidual=0;
  const add=(x,y)=>{if(finite(x)&&finite(y)){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}};
  for(const entry of runs){
    for(const row of entry.run.samples)add(row.time,row.position);
    for(const f of entry.forecasts)if(f.status==='executed')for(const row of f.rollout.rows){add(row.time,row.predicted);if(finite(row.predicted)&&finite(row.observed))maxResidual=Math.max(maxResidual,Math.abs(row.predicted-row.observed));}
  }
  if(![x0,x1,y0,y1,x1-x0,y1-y0].every(finite))return null;
  if(x1===x0){x0-=0.5;x1+=0.5;}
  const padding=Math.max((y1-y0)*0.08,0.01);
  return {x:[x0,x1],y:[y0-padding,y1+padding],residualBound:Math.max(maxResidual*1.12,0.0001)};
}
function path(points,key,x,y){
  let d='',down=false;
  for(const p of points){if(!finite(p.time)||!finite(p[key])){down=false;continue;}d+=(down?'L':'M')+x(p.time).toFixed(3)+','+y(p[key]).toFixed(3)+' ';down=true;}
  return d;
}
function legend(modes){
  const list=el('ul',undefined,'environment-course-legend');
  for(const item of [{label:'Recorded angle',color:'#17212b',dash:null},...modes]){
    const li=el('li'),sample=svg('svg',{viewBox:'0 0 44 12',width:44,height:12,'aria-hidden':'true'});
    sample.append(svg('line',{x1:2,y1:6,x2:42,y2:6,stroke:item.color,'stroke-width':item.dash?2:3,...(item.dash?{'stroke-dasharray':item.dash}:{})}));
    li.append(sample,document.createTextNode(item.label));list.append(li);
  }
  return list;
}

function residualCourse(entry,modes,range,condition,role,width){
  const w=Math.max(300,Math.min(1000,width)),h=170,m={left:58,right:14,top:18,bottom:42},pw=w-m.left-m.right,ph=h-m.top-m.bottom;
  const x=v=>m.left+(v-range.x[0])/(range.x[1]-range.x[0])*pw,y=v=>m.top+(1-(v+range.residualBound)/(2*range.residualBound))*ph;
  const id='environment-residual-'+(++sequence),drawing=svg('svg',{viewBox:'0 0 '+w+' '+h,role:'img','aria-labelledby':id+'-title '+id+'-desc',width:'100%',height:h});
  drawing.classList.add('environment-residual-plot');
  drawing.append(svg('title',{id:id+'-title'},condition+' '+role+': prediction minus observation'),
    svg('desc',{id:id+'-desc'},'Signed angle difference at the original observed timestamps. Positive values are overprediction. Zero is agreement. Symmetric ranges are shared across this evidence role.'));
  for(const value of [-range.residualBound,0,range.residualBound])drawing.append(
    svg('line',{x1:m.left,x2:w-m.right,y1:y(value),y2:y(value),stroke:value===0?'#7c8b99':'#dce2e8','stroke-width':value===0?1.5:1}),
    svg('text',{x:m.left-8,y:y(value)+4,'text-anchor':'end','font-size':12,fill:'#344150'},value===0?'0':Number(value.toPrecision(2))));
  for(let i=0;i<=2;i++){const t=range.x[0]+i/2*(range.x[1]-range.x[0]);drawing.append(svg('text',{x:x(t),y:h-20,'text-anchor':'middle','font-size':12,fill:'#344150'},Number(t.toPrecision(4))));}
  drawing.append(svg('text',{x:m.left+pw/2,y:h-2,'text-anchor':'middle','font-size':12,fill:'#344150'},'Original time (s)'));
  for(const mode of modes){
    const f=entry.forecasts.find(f=>f.mode===mode.id);if(f?.status!=='executed')continue;
    // Derive the signed difference from paired values, independent of any stored residual convention.
    const points=f.rollout.rows.map(row=>({time:row.time,difference:finite(row.predicted)&&finite(row.observed)?row.predicted-row.observed:NaN}));
    drawing.append(svg('path',{d:path(points,'difference',x,y),fill:'none',stroke:mode.color,'stroke-width':1.8,'stroke-dasharray':mode.dash,'vector-effect':'non-scaling-stroke','data-mode':mode.id,
      'data-first-scored-residual':points[1]?.difference??'unavailable'}));
  }
  return drawing;
}

function recording(entry,modes,range,condition,role,width){
  const figure=el('figure',undefined,'environment-course');
  figure.append(el('figcaption',condition+' · '+entry.run.label+' · '+role));
  if(!range){figure.append(el('p','Plot range is not finite; all numerical outcomes remain below.'));return figure;}
  const id='environment-course-'+(++sequence),w=Math.max(300,Math.min(1000,width)),h=w<480?250:280;
  const m={left:58,right:14,top:18,bottom:48},pw=w-m.left-m.right,ph=h-m.top-m.bottom;
  const x=v=>m.left+(v-range.x[0])/(range.x[1]-range.x[0])*pw;
  const y=v=>m.top+(1-(v-range.y[0])/(range.y[1]-range.y[0]))*ph;
  const drawing=svg('svg',{viewBox:'0 0 '+w+' '+h,role:'img','aria-labelledby':id+'-title '+id+'-description',width:'100%',height:h});
  drawing.append(svg('title',{id:id+'-title'},condition+': '+role+' against recorded angle'),
    svg('desc',{id:id+'-description'},entry.run.samples.length+' source samples; original seconds and radians. '+modes.map(m=>m.label).join(', ')+'. All plots in this course share axis ranges. Errors and failures are listed below.'));
  const defs=svg('defs'),clip=svg('clipPath',{id:id+'-clip'});clip.append(svg('rect',{x:m.left,y:m.top,width:pw,height:ph}));defs.append(clip);drawing.append(defs);
  const ticks=w<480?2:4;
  for(let i=0;i<=ticks;i++){
    const f=i/ticks,t=range.x[0]+f*(range.x[1]-range.x[0]),p=range.y[0]+f*(range.y[1]-range.y[0]);
    drawing.append(svg('line',{x1:m.left,x2:w-m.right,y1:y(p),y2:y(p),stroke:'#dce2e8'}),
      svg('text',{x:m.left-8,y:y(p)+4,'text-anchor':'end','font-size':12,fill:'#344150'},Number(p.toPrecision(3))),
      svg('text',{x:x(t),y:h-m.bottom+20,'text-anchor':'middle','font-size':12,fill:'#344150'},Number(t.toPrecision(4))));
  }
  drawing.append(svg('text',{x:m.left+pw/2,y:h-8,'text-anchor':'middle','font-size':13,fill:'#17212b'},'Original time (s)'),
    svg('text',{transform:'translate(15 '+(m.top+ph/2)+') rotate(-90)','text-anchor':'middle','font-size':13,fill:'#17212b'},'Angle (rad)'));
  const traces=svg('g',{'clip-path':'url(#'+id+'-clip)'});
  for(const mode of modes){
    const f=entry.forecasts.find(f=>f.mode===mode.id);
    if(f?.status==='executed')traces.append(svg('path',{d:path(f.rollout.rows,'predicted',x,y),fill:'none',stroke:mode.color,'stroke-width':2,'stroke-dasharray':mode.dash,'vector-effect':'non-scaling-stroke'}));
  }
  traces.append(svg('path',{d:path(entry.run.samples,'position',x,y),fill:'none',stroke:'#17212b','stroke-width':2.6,'vector-effect':'non-scaling-stroke'}));
  const stride=Math.max(1,Math.ceil(entry.run.samples.length/70));
  entry.run.samples.forEach((p,i)=>{if(i%stride===0||i===entry.run.samples.length-1)traces.append(svg('circle',{cx:x(p.time),cy:y(p.position),r:1.6,fill:'#17212b'}));});
  drawing.append(traces);figure.append(drawing,el('p','Prediction − observation (rad) · symmetric scale shared across this '+(role==='Training fit'?'training':'challenge')+' course','environment-residual-label'),residualCourse(entry,modes,range,condition,role,width),legend(modes));
  const measures=el('dl',undefined,'environment-run-metrics');
  for(const mode of modes){const f=entry.forecasts.find(f=>f.mode===mode.id);measures.append(el('dt',mode.label),el('dd',f?.status==='executed'?'Angle RMSE '+environmentFormat(f.rollout.metrics.positionRMSE)+' rad · half step '+environmentFormat(f.refinement?.metrics?.positionRMSE)+' rad':f?.failureReason??'Unavailable'));}
  figure.append(measures);
  for(const mode of modes){const f=entry.forecasts.find(f=>f.mode===mode.id);if(f?.status!=='executed')figure.append(el('p',mode.label+': '+(f?.failureReason??'No forecast available'),'environment-failure'));}
  return figure;
}
export function renderEnvironmentCourses(container,{environments,course,arrangement='conditions'}){
  const fragment=document.createDocumentFragment(),runs=course?.runs??[];
  if(!runs.length){container.replaceChildren(el('p','No recordings have been evaluated.'));return;}
  const range=domains(runs),role=course.role==='challenge'?'Challenge forecast':'Training fit';
  const width=Math.max(300,container.getBoundingClientRect().width||800);
  if(arrangement==='models'){
    for(const mode of MODES){
      const section=el('section',undefined,'environment-model-courses');section.append(el('h3',role+' · '+mode.label));
      const grid=el('div',undefined,'environment-condition-grid');
      for(const env of environments){
        const condition=el('section');condition.append(el('h4',env.label));
        for(const entry of runs.filter(r=>r.environmentId===env.id))condition.append(recording(entry,[mode],range,env.label,role,width>760?(width-24)/2:width));
        grid.append(condition);
      }
      section.append(grid);fragment.append(section);
    }
  }else{
    for(const env of environments){
      const section=el('section',undefined,'environment-condition-courses');section.append(el('h3',env.label+' · '+role));
      for(const entry of runs.filter(r=>r.environmentId===env.id))section.append(recording(entry,MODES,range,env.label,role,width));
      fragment.append(section);
    }
  }
  fragment.append(el('p','Predictions that closely match the recording may overlap the recorded trace. Every source sample remains in each plotted path.','environment-plot-note'));
  container.replaceChildren(fragment);
}
function metrics(cell,course,mode,expectedRole){
  if(!course){cell.textContent=expectedRole==='training'?'Not evaluated':'Not received';return;}
  const list=el('ul');
  for(const entry of course.runs){
    const f=entry.forecasts.find(f=>f.mode===mode),li=el('li');
    li.append(el('strong',entry.run.label+': '));
    if(f?.status==='executed'){
      li.append(document.createTextNode(environmentFormat(f.rollout.metrics.positionRMSE)+' rad'));
      const detail=el('small','Half step: '+environmentFormat(f.refinement?.metrics?.positionRMSE)+' rad; prediction-step RMS: '+environmentFormat(f.refinement?.predictionRMSDifference)+' rad.');
      if(f.refinement?.status!=='executed')detail.textContent='Half-step forecast failed: '+(f.refinement?.failureReason??'Unavailable');
      li.append(detail);
    }else li.append(document.createTextNode(f?.failureReason??'Unavailable'));
    list.append(li);
  }
  cell.append(list);
}
export function renderEnvironmentOutcomeTable(container,{comparison,trainingCourse,challengeCourse}){
  const table=el('table',undefined,'environment-outcome-table');
  table.append(el('caption','The best training candidate within each assumption. Future angle RMSE excludes the supplied initial sample; refinement RMS includes it.'));
  const head=el('thead'),header=el('tr');
  for(const text of ['Assumption','Training selection','Training angle RMSE','Challenge angle RMSE']){const th=el('th',text);th.scope='col';header.append(th);}
  head.append(header);const body=el('tbody');
  for(const mode of MODES){
    const tr=el('tr'),label=el('th',mode.label);label.scope='row';
    const selection=el('td'),train=el('td'),challenge=el('td');
    const c=comparison.candidates.find(c=>c.id===comparison.bestByMode[mode.id]);
    if(c){selection.append(el('p',c.selectedTerms.join(' + ')||'Zero acceleration'),el('p','Score '+environmentFormat(c.score)+' · '+c.freeParameterCount+' free coefficients'),
      el('small','Weak RMSE '+environmentFormat(c.weakRMSE)+' normalized rad'));}
    else selection.textContent='No executable candidate';
    metrics(train,trainingCourse,mode.id,'training');metrics(challenge,challengeCourse,mode.id,'challenge');
    tr.append(label,selection,train,challenge);body.append(tr);
  }
  table.append(head,body);container.replaceChildren(table);
}
