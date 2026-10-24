import {prepareAdditiveSlice} from './additive-source.mjs';
export const ADDITIVE_GRAPH_SCHEMA='worldlaw.additive-source-graph/v1';
export const MAX_GRAPH_WORK=2000000;
// Exact dyadic decomposition adapted from maintained cycle-work/angle-boxes.mjs.
const view=new DataView(new ArrayBuffer(8));
function dyadic(value){
 if(value===0)return {n:0n,e:0};
 view.setFloat64(0,value);const bits=view.getBigUint64(0),exp=Number((bits>>52n)&2047n);
 let n=(bits&((1n<<52n)-1n))|(exp?1n<<52n:0n),e=exp?exp-1075:-1074;
 while((n&1n)===0n){n>>=1n;e++;}return {n:bits>>63n?-n:n,e};
}
const pack=(n,e)=>({integer:n.toString(),powerOfTwo:e});
export function inspectSparseAdditivity(observations,declaration,{maxWork=MAX_GRAPH_WORK}={}){
 const prepared=prepareAdditiveSlice(observations,declaration),{rows,states}=prepared;
 if(!Number.isInteger(maxWork)||maxWork<1||maxWork>MAX_GRAPH_WORK)throw new RangeError('Unsupported complete graph work limit');
 const base={schema:ADDITIVE_GRAPH_SCHEMA,declaration:{axes:[prepared.x,prepared.y],fixedValue:prepared.fixedValue,torqueRadius:prepared.torqueRadius,exactCoordinates:true},fixedAxis:prepared.fixedAxis,
  sourceRowCount:rows.length,sliceRowCount:states.reduce((n,s)=>n+s.rowIndices.length,0),states,maxWork,
  arithmetic:'Exact dyadic decisions on admitted binary64 readings and radius; displayed approximations do not decide.',
  interpretation:'Compatibility only on the observed finite slice under declared exact coordinates and absolute reading bounds; not a specific finite-library fit, physical law, unseen-state prediction or calibrated confidence.'};
 const values=[dyadic(declaration.torqueRadius),...states.flatMap(s=>s.rowIndices.map(i=>dyadic(rows[i].jointTorque)))];
 const exponent=Math.min(...values.map(d=>d.e));const exact=x=>{const d=dyadic(x);return d.n<<BigInt(d.e-exponent);};
 const radius=exact(declaration.torqueRadius),nodes=[],xs=new Map(),ys=new Map(),edges=[];
 const node=(map,value,axis)=>{if(!map.has(value)){map.set(value,nodes.length);nodes.push({axis,value});}return map.get(value);};
 for(const state of states){
  const x=node(xs,state.x,declaration.axes[0]),y=node(ys,state.y,declaration.axes[1]);
  let low=null,high=null,lowerRow,upperRow;
  for(const index of state.rowIndices){const t=exact(rows[index].jointTorque),a=t-radius,b=t+radius;
   if(low===null||a>low){low=a;lowerRow=index;}if(high===null||b<high){high=b;upperRow=index;}}
  if(low>high)return {...base,status:'incompatible-replicates',conflict:{state:state.id,rows:[lowerRow,upperRow],lowerBound:pack(low,exponent),upperBound:pack(high,exponent)}};
  edges.push({from:y,to:x,weight:high,row:upperRow,sign:1,state:state.id},{from:x,to:y,weight:-low,row:lowerRow,sign:-1,state:state.id});
 }
 if(!nodes.length)return {...base,status:'no-source-states',work:0,potentials:[]};
 if(nodes.length*edges.length>maxWork)throw new RangeError('Complete graph exceeds exact relaxation work limit; no partial result');
 base.nodes=nodes;base.edgeCount=edges.length;
 const distance=nodes.map(()=>0n),predecessor=nodes.map(()=>null);let changed=null,work=0;
 for(let pass=0;pass<nodes.length;pass++){
  changed=null;
  edges.forEach((edge,index)=>{work++;if(distance[edge.to]>distance[edge.from]+edge.weight){distance[edge.to]=distance[edge.from]+edge.weight;predecessor[edge.to]=index;changed=edge.to;}});
  if(changed===null){
   if(!edges.every(e=>distance[e.to]-distance[e.from]<=e.weight))throw Error('Invalid constructive witness');
   return {...base,status:'compatible-on-observed-slice',work,potentials:nodes.map((node,i)=>({...node,valueExact:pack(node.axis===declaration.axes[0]?distance[i]:-distance[i],exponent)}))};
  }
 }
 let cursor=changed;for(let i=0;i<nodes.length;i++)cursor=edges[predecessor[cursor]].from;
 const start=cursor,cycle=[];do{const edge=edges[predecessor[cursor]];cycle.push(edge);cursor=edge.from;}while(cursor!==start);
 const sum=cycle.reduce((v,e)=>v+e.weight,0n);if(sum>=0n)throw Error('Invalid exclusion witness');
 return {...base,status:'additivity-excluded',work,witness:{edges:cycle.reverse().map(({weight,...edge})=>edge),upperBound:pack(sum,exponent),interpretation:'Exact sum of original source upper constraints is strictly negative; no common additive assignment can receive all slice readings under declared bounds.'}};
}
