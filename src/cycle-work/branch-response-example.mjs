import {cycleExample} from './core.mjs';
import {BRANCH_RESPONSE_SCHEMA,BRANCH_RECEIVING_ASSUMPTION,normalizeBranchRequest} from './branch-response.mjs';
const response=(theta,s,kind)=>.3-1.2*theta+(kind==='position'?0:s*(.2+.1*theta))+(kind==='omitted'?.15*s*theta**3:0);
function acquisition(id,positions,kind,drift=0){
 const cycle=cycleExample(),angles=[...positions,...positions.toReversed()],branches=angles.map((_,i)=>i<positions.length?1:-1);
 cycle.source='Authored '+kind+' response at separate declared angles; '+(drift?'changed conservative slope; ':'')+'not physical acquisition';
 cycle.samples=angles.map((position,i)=>({position,jointTorque:response(position,branches[i],kind)+drift*position,torqueRadius:.002}));
 return {id,cycle,branches};
}
export function branchResponseExample(kind='branch'){
 if(!['branch','position','omitted'].includes(kind))throw Error('Unknown response-law control.');
 return {schema:BRANCH_RESPONSE_SCHEMA,request:{training:[acquisition('training-one',[0,.5,1,1.5,2],kind),acquisition('training-two',[0,.25,.75,1.75,2],kind)],settings:{trainingRmsTolerance:.02,receivingRmsTolerance:.02,basis:'Authored0.02 N·m RMS discrepancy gate and0.002 N·m reading boxes; not calibrated'}},acquisition:null};
}
export function receiveAuthoredBranch(raw,kind='branch',drift=false){
 const request=normalizeBranchRequest(branchResponseExample(kind).request);
 if(JSON.stringify(normalizeBranchRequest(raw.request))!==JSON.stringify(request))throw Error('Authored receiving is available only for the unchanged matching control.');
 return {schema:BRANCH_RESPONSE_SCHEMA,request,acquisition:{request,assumption:BRANCH_RECEIVING_ASSUMPTION,records:[acquisition(drift?'receiving-drift':'receiving-matching',[0,.4,.9,1.3,2],kind,drift?.4:0)]}};
}
