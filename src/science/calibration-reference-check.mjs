/** Internal exact source check; caller first validates the complete report. */
import{rational as q,add,sub,mul,div,neg,clip,serial,cmp,enclosure}from'../unknown-lab/chronos-exact-halfplanes.mjs';
export function checkReferenceStandards(report){
 const [a,b]=report.standards,gap=sub(q(b.reportedTorque),q(a.reportedTorque));
 const bounds=report.standards.map(s=>{const center=sub(q(s.referenceTorque),q(s.reportedTorque)),radius=q(s.absoluteError);return[sub(center,radius),add(center,radius)];});
 let polygon=[[bounds[0][0],bounds[1][0]],[bounds[0][1],bounds[1][0]],[bounds[0][1],bounds[1][1]],[bounds[0][0],bounds[1][1]]];
 const work={count:0,limit:200000};
 for(const s of report.checkStandards??[]){const v=div(sub(q(s.reportedTorque),q(a.reportedTorque)),gap),u=sub(q(1),v),target=sub(q(s.referenceTorque),q(s.reportedTorque)),radius=q(s.absoluteError);polygon=clip(polygon,u,v,add(target,radius),work);polygon=clip(polygon,neg(u),neg(v),neg(sub(target,radius)),work);}
 const correctedGaps=polygon.map(([u,v])=>add(gap,sub(v,u)));
 const minimum=correctedGaps.length?correctedGaps.reduce((a,b)=>cmp(a,b)<0?a:b):null;
 const guard=128*Number.EPSILON*Math.max(1,...report.standards.flatMap(s=>[Math.abs(s.reportedTorque),Math.abs(s.referenceTorque),s.absoluteError]));
 const positiveFactor=minimum!==null&&cmp(minimum,q(guard))>0;
 return{positiveFactor,minimumCorrectedGap:minimum===null?null:enclosure(minimum),positiveGapAllowance:guard,status:polygon.length?'not-excluded':'contradicted',checks:report.checkStandards?.length??0,vertices:polygon.map(p=>p.map(serial)),work:work.count,qualification:'Exact affine consistency of supplied binary64 source bounds. Nonempty does not authenticate the report or establish physical calibration; every additional standard constrains the same two original correction values.'};
}
