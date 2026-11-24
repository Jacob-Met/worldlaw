// Last coefficient is the constant. All other coordinates are independent
// source terminals. Undefined/nonlinear subexpressions retain the general path.
const fixedUnary = {sin: Math.sin, cos: Math.cos, abs: Math.abs, tanh: Math.tanh};
const spatialCoordinate={gradient:'dx',laplacian:'dxx',thirdDerivative:'dxxx',biharmonic:'dxxxx'};
export function affineCoefficients(tree, variables, constants={}) {
  const k=variables.length;
  const constant=row=>row.slice(0,k).every(v=>v===0);
  function visit(tree) {
    if (typeof tree==='string') {
      const row=Array(k+1).fill(0), i=variables.indexOf(tree);
      if (i!==-1) row[i]=1;
      else if (tree==='one') row[k]=1;
      else if (Object.hasOwn(constants,tree)) row[k]=constants[tree];
      else return null;
      return row;
    }
    const [operator,left,right]=tree;
    if (Object.hasOwn(spatialCoordinate,operator)) {
      const index=variables.indexOf(spatialCoordinate[operator]);
      if (index===-1) return null;
      const potential=affineCoefficients(left,['field']);
      if (!potential) return null;
      const row=Array(k+1).fill(0);row[index]=potential[0];return row;
    }
    const x=visit(left);
    if (!x) return null;
    let result;
    if (right===undefined) {
      if (!constant(x)||!Object.hasOwn(fixedUnary,operator)) return null;
      result=Array(k+1).fill(0);result[k]=fixedUnary[operator](x[k]);
    } else {
      const y=visit(right);
      if (!y) return null;
      if (operator==='add') result=x.map((v,i)=>v+y[i]);
      else if (operator==='mul'&&constant(x)) result=y.map(v=>x[k]*v);
      else if (operator==='mul'&&constant(y)) result=x.map(v=>v*y[k]);
      else if (operator==='div'&&constant(y)&&y[k]!==0) result=x.map(v=>v/y[k]);
      else return null;
    }
    return result.every(Number.isFinite)?result:null;
  }
  return visit(tree);
}
