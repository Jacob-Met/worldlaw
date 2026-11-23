/** Bounded finite command programs shared by both feedback-tree planners. */
export const TREE_PLAN='worldlaw.position-drift-feedback-tree-policy/v1';
const need=(ok,msg)=>{if(!ok)throw Error('Feedback tree: '+msg);};

export function compileTree(program,commands){
  let count=0,horizon=null;
  function build(raw,depth,history){
    need(++count<=32&&depth<=4,'at most 32 nodes and four committed segments per path');
    const keys=raw&&Object.keys(raw).sort().join(',');
    need((keys==='commands'||keys==='alternatives,commands')&&Array.isArray(raw.commands)&&raw.commands.length>0&&
      raw.commands.every(u=>commands.includes(u)),'each node commits a nonempty catalog command sequence');
    const node={id:count-1,commands:raw.commands.slice(),word:[...history,...raw.commands]};
    need(node.word.length<=16,'at most sixteen pulses on a path');
    if(keys==='commands'){
      if(horizon===null)horizon=node.word.length;
      need(horizon===node.word.length,'all leaves must use the same pulse budget');
      node.alternatives=[];return node;
    }
    need(Array.isArray(raw.alternatives)&&raw.alternatives.length>0&&raw.alternatives.length<=8,'offer one to eight continuations');
    node.alternatives=raw.alternatives.map(child=>build(child,depth+1,node.word));
    return node;
  }
  const root=build(program,1,[]);
  return {root,horizon};
}

