import {fitLinearColumns} from './linear-fit.mjs';
/** Algebraic columns of the least-squares reading-to-coefficient map.
 * Callers own bounded dimensions and finite column admission. Unit targets are
 * perturbations, not acquired observations. Null retains a QR refusal. */
export function linearReadingInfluences(columns,rowCount){
 const influence=columns.map(()=>[]);
 for(let row=0;row<rowCount;row++){
  const target=Array(rowCount).fill(0);target[row]=1;
  const response=fitLinearColumns(columns,target);
  if(!response)return null;
  response.coefficients.forEach((value,j)=>influence[j].push(value));
 }
 return influence;
}
