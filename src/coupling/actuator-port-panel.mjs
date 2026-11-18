import {comparePortObservation, criteria, readRealAIGymCsv, schedulePortObservations} from './actuator-port.mjs';

const svgNS='http://www.w3.org/2000/svg';
const publisher='https://raw.githubusercontent.com/dfki-ric-underactuated-lab/real_ai_gym_leaderboard/81ea5bc877d4371d6d938b711a27e0c3fbb923f2/data/';
const examples={
  mc:{path:'acrobot/real_system/MC-PILCO/experiment01/trajectory.csv',hash:'033055f440e3fc9efaf8e1451ac14e40bfb38c22f87066224459fd3686e83eee'},
  shoulder:{path:'pendubot/real_system/ilqr_tvlqr_lqr/experiment10/trajectory.csv',hash:'8a290bc545d9acf700e340e90370eb632889d711ee037b57d4508c25b4fa8888'},
  elbow:{path:'acrobot/real_system/ilqr_tvlqr_lqr/experiment03/trajectory.csv',hash:'1e9ccd0d295bca29d73efd80fef5be7d273d804774960104335616155af10072'}
};
const colors={shoulder:'#ffbf68',elbow:'#79dfdb',observed:'#f9f6ef'};
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
function svg(tag,attributes,text) {
  const element=document.createElementNS(svgNS,tag);
  for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);
  if(text!==undefined)element.textContent=text;
  return element;
}

function draw(plot, plan, target, initial, measured) {
  const steps=plan.predictions.filter(row=>row.index<=target.index);
  const deltas=point=>[wrap(point[0]-initial[0]),wrap(point[1]-initial[1])];
  const shoulder=[[0,0],...steps.map(p=>deltas(p.shoulder))];
  const elbow=[[0,0],...steps.map(p=>deltas(p.elbow))];
  const observation=measured?deltas(measured):null;
  const points=[...shoulder,...elbow,...(observation?[observation]:[])];
  const bounds=[0,1].map(k=>[Math.min(...points.map(p=>p[k])),Math.max(...points.map(p=>p[k]))]);
  const span=Math.max(.04,bounds[0][1]-bounds[0][0],bounds[1][1]-bounds[1][0])*1.20;
  const center=bounds.map(([a,b])=>(a+b)/2);
  const xy=([a,b])=>[212+240*(a-center[0])/span,133-240*(b-center[1])/span];
  const [ox,oy]=xy([0,0]);
  plot.replaceChildren(
    svg('line',{x1:40,x2:389,y1:oy,y2:oy,class:'hardware-axis'}),
    svg('line',{x1:ox,x2:ox,y1:11,y2:249,class:'hardware-axis'}),
    svg('text',{x:385,y:270,'text-anchor':'end'},'Shoulder change (rad)'),
    svg('text',{x:12,y:17},'Elbow change (rad)'),
    svg('text',{x:14,y:270},'Scale bar '+(span/4).toFixed(3)+' rad'),
    svg('line',{x1:14,x2:74,y1:249,y2:249,stroke:'currentColor'})
  );
  for(const [port,path] of [['shoulder',shoulder],['elbow',elbow]]){
    const coords=path.map(xy);
    plot.append(svg('polyline',{points:coords.map(p=>p.join(',')).join(' '),fill:'none',stroke:colors[port],'stroke-width':3,'stroke-dasharray':port==='shoulder'?'7 4':'none'}));
    const [x,y]=coords.at(-1);
    plot.append(svg('circle',{cx:x,cy:y,r:4,fill:colors[port]}));
  }
  if(observation){
    const [x,y]=xy(observation);
    plot.append(svg('circle',{cx:x,cy:y,r:8,fill:'none',stroke:colors.observed,'stroke-width':2.5}));
  }
}

export function mountHardwareReplay(root) {
  const get=name=>root.querySelector('[data-port="'+name+'"]');
  const status=get('status'), plot=get('plot'), reveal=get('reveal'), facts=get('facts');
  let current=null, version=0;
  const begin=()=>{
    current=null; reveal.disabled=true; facts.hidden=true; plot.setAttribute('hidden','');
    get('source').textContent='';get('reading').textContent='';return ++version;
  };
  async function receive(bytes,name,request,expectedHash){
    if(bytes.byteLength>12*1024*1024)throw new Error('Recording exceeds 12 MiB.');
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(expectedHash && digest!==expectedHash)throw new Error('The recording differs from the pinned publisher acquisition.');
    const record=readRealAIGymCsv(new TextDecoder().decode(bytes));
    const start=record.drive.findIndex(p=>Math.abs(p.torque)>=criteria.triggerNm);
    if(start<0)throw new Error('No anonymous command reaches 0.25 N m.');
    const plan=schedulePortObservations(record.drive,start,record.states[start],parseInt(digest.slice(0,8),16)/2**32);
    if(request!==version)return;
    current={record,plan,start,digest};
    get('source').textContent=name+' · '+record.drive.length+' logged samples · SHA-256 '+digest;
    showForecast();
  }
  function showForecast(){
    if(!current)return;
    const {record,plan,start}=current;
    const clock=get('clock').value, target=plan.clocks[clock];
    get('time').textContent=(1000*target.elapsed).toFixed(1)+' ms after the drive begins';
    get('separation').textContent=target.separation.toFixed(3)+' rad between predictions';
    get('reading').textContent='The forecast uses the recorded command and the initial encoder state.';
    status.textContent=clock==='fixed100'?'The fixed observation time is locked.':
      target.separation>=criteria.separationRad?'The predictions crossed 0.12 rad. The observation time is locked.':'The 0.35 s horizon ended before the predictions separated by 0.12 rad.';
    draw(plot,plan,target,record.states[start]);plot.removeAttribute('hidden');facts.hidden=false;reveal.disabled=false;
  }
  get('clock').addEventListener('change',showForecast);
  async function load(getBytes,name,expectedHash){
    const request=begin();status.textContent='Reading the acquisition…';
    try{await receive(await getBytes(),name,request,expectedHash);}
    catch(error){if(request===version)status.textContent=error.message;}
  }
  get('file').addEventListener('change',e=>{
    const file=e.target.files[0];if(file)load(()=>file.arrayBuffer(),file.name);
  });
  get('example').addEventListener('click',()=>{
    const selected=get('recording'), sample=examples[selected.value];
    load(async()=>{
    const response=await fetch(publisher+sample.path);
    if(!response.ok)throw new Error('The publisher returned HTTP '+response.status+'. Choose a downloaded recording.');
    return response.arrayBuffer();
  },selected.selectedOptions[0].textContent,sample.hash);
  });
  reveal.addEventListener('click',()=>{
    if(!current)return;
    const {record,plan,start}=current;
    const target=plan.clocks[get('clock').value], observed=record.states[target.index];
    const result=comparePortObservation(target,observed);
    draw(plot,plan,target,record.states[start],observed);
    status.textContent=result.winner==='unresolved'?'This observation did not distinguish the two drive ports.':(result.winner==='elbow'?'Elbow':'Shoulder')+' drive has the lower measured angle error.';
    get('reading').textContent='Encoder residuals · shoulder '+result.shoulderError.toFixed(3)+' rad · elbow '+result.elbowError.toFixed(3)+' rad.';
    reveal.disabled=true;
  });
}
