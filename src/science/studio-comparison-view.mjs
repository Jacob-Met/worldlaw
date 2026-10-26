/** Draw only samples returned by the maintained Studio dynamics comparison. */
const print = value => Number.isFinite(value) ? Number(value.toPrecision(4)).toString() : '—';
export function drawCompetitiveMotion(ctx,w,h,frame) {
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(217,240,219,.06)';ctx.lineWidth=1;
  for(let x=20;x<w;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=20;y<h;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  if(frame.view==='phase') drawPhase(ctx,w,h,frame);
  else drawJoints(ctx,w,h,frame);
  ctx.save();ctx.font='11px ui-monospace,monospace';ctx.fillStyle='#c8d9ce';
  ctx.fillText('t '+print(frame.time)+' s · '+(frame.paused?'PAUSED':'PREDICTION'),18,h-15);
  ctx.textAlign='right';
  ctx.fillText(frame.complete?frame.total+' COMPETING LAWS':'INCOMPLETE '+frame.samples.length+'/'+frame.total,w-18,h-15);
  ctx.restore();
}
function drawJoints(ctx,w,h,frame){
  const cx=w*.5,cy=(h-26)/2,len=Math.max(1,Math.min(w*.32,cx-30,w-cx-30,cy-32,h-cy-44));
  ctx.save();ctx.setLineDash([3,6]);ctx.strokeStyle='rgba(199,230,209,.23)';
  ctx.beginPath();ctx.arc(cx,cy,len,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx,cy+len+20);ctx.stroke();ctx.restore();
  ctx.fillStyle='#284a3c';ctx.beginPath();ctx.roundRect(cx-43,cy-25,86,26,4);ctx.fill();
  const order=frame.samples.map((sample,index)=>index).reverse();
  if(frame.highlightId){const at=order.findIndex(i=>frame.samples[i].id===frame.highlightId);if(at>=0)order.push(...order.splice(at,1));}
  for(const i of order){
    const sample=frame.samples[i],path=frame.paths[i].trajectory,highlighted=sample.id===frame.highlightId;
    const strength=!frame.highlightId||highlighted?1:.32;
    ctx.save();ctx.strokeStyle=sample.color;ctx.fillStyle=sample.color;
    ctx.globalAlpha=.25*strength;ctx.lineWidth=2;ctx.beginPath();
    for(let j=Math.max(0,frame.sampleIndex-40);j<=frame.sampleIndex;j++){
      const x=cx+Math.sin(path[j].position)*len,y=cy+Math.cos(path[j].position)*len;
      if(j===Math.max(0,frame.sampleIndex-40))ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();ctx.globalAlpha=strength;
    const x=cx+Math.sin(sample.position)*len,y=cy+Math.cos(sample.position)*len;
    ctx.lineWidth=highlighted?4:2.5;ctx.setLineDash(highlighted?[]:[7+i%3,4]);
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(x,y,highlighted?13:9,0,Math.PI*2);
    if(highlighted){ctx.shadowColor=sample.color;ctx.shadowBlur=14;ctx.fill();ctx.shadowBlur=0;}
    else {ctx.fillStyle='#17382b';ctx.fill();ctx.stroke();}
    ctx.fillStyle=sample.color;ctx.font='bold 11px ui-monospace,monospace';ctx.textAlign=x>cx?'left':'right';
    if(frame.samples.length<=4||highlighted)ctx.fillText(sample.label,x+(x>cx?17:-17),Math.max(16,y-11));ctx.restore();
  }
  ctx.fillStyle='#dce9d6';ctx.beginPath();ctx.arc(cx,cy,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#123426';ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();
}
function drawPhase(ctx,w,h,frame){
  let q0=Infinity,q1=-Infinity,v0=Infinity,v1=-Infinity;
  for(const path of frame.paths)for(const point of path.trajectory){
    q0=Math.min(q0,point.position);q1=Math.max(q1,point.position);
    v0=Math.min(v0,point.rate);v1=Math.max(v1,point.rate);
  }
  const qp=Math.max((q1-q0)*.1,1e-5),vp=Math.max((v1-v0)*.13,1e-5);
  q0-=qp;q1+=qp;v0-=vp;v1+=vp;
  ctx.save();ctx.font='10px ui-monospace,monospace';
  const tickWidth=Math.max(...[0,1,2].map(i=>ctx.measureText(print(v0+(v1-v0)*i/2)).width));
  ctx.restore();
  const L=Math.max(76,Math.ceil(tickWidth)+30),R=20,T=20,B=54;
  const X=q=>L+(q-q0)/(q1-q0)*(w-L-R),Y=v=>h-B-(v-v0)/(v1-v0)*(h-T-B);
  ctx.save();ctx.font='10px ui-monospace,monospace';ctx.fillStyle='#b6cabc';ctx.strokeStyle='#42624f';ctx.lineWidth=1;
  for(let i=0;i<=2;i++){
    const q=q0+(q1-q0)*i/2,v=v0+(v1-v0)*i/2;
    ctx.beginPath();ctx.moveTo(X(q),T);ctx.lineTo(X(q),h-B);ctx.stroke();
    ctx.beginPath();ctx.moveTo(L,Y(v));ctx.lineTo(w-R,Y(v));ctx.stroke();
    ctx.textAlign='center';ctx.fillText(print(q),X(q),h-B+15);
    ctx.textAlign='right';ctx.fillText(print(v),L-7,Y(v)+4);
  }
  const order=frame.paths.map((path,index)=>index);
  if(frame.highlightId){const at=order.findIndex(i=>frame.paths[i].id===frame.highlightId);if(at>=0)order.push(...order.splice(at,1));}
  for(const i of order){
    const path=frame.paths[i],sample=frame.samples[i],highlighted=sample.id===frame.highlightId;
    ctx.strokeStyle=path.color;ctx.lineWidth=highlighted?3:1.8;ctx.globalAlpha=!frame.highlightId||highlighted?0.65:0.2;ctx.beginPath();
    path.trajectory.forEach((p,j)=>{if(!j)ctx.moveTo(X(p.position),Y(p.rate));else ctx.lineTo(X(p.position),Y(p.rate));});
    ctx.stroke();ctx.globalAlpha=!frame.highlightId||highlighted?1:.35;ctx.fillStyle=path.color;
    ctx.beginPath();ctx.arc(X(sample.position),Y(sample.rate),highlighted?7:4,0,Math.PI*2);ctx.fill();
    ctx.textAlign='left';if(frame.samples.length<=4||highlighted)ctx.fillText(sample.label,X(sample.position)+8,Y(sample.rate)-7);
  }
  ctx.globalAlpha=1;ctx.fillStyle='#d7e2d7';ctx.textAlign='center';ctx.fillText('Angle θ (rad)',(L+w-R)/2,h-B+30);
  ctx.save();ctx.translate(12,(T+h-B)/2);ctx.rotate(-Math.PI/2);ctx.fillText('Rate ω (rad/s)',0,0);ctx.restore();ctx.restore();
}
