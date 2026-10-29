// Reimplemented after host reset; not asserted byte-identical to prior primitive.
// Dekker product decomposition; admitted fit values must stay within normal
// splitter range. Nonfinite products propagate into explicit unresolved outcomes.
export function productPair(a,b){
 const p=a*b,ca=134217729*a,cb=134217729*b;
 const ah=ca-(ca-a),al=a-ah,bh=cb-(cb-b),bl=b-bh;
 return [p,((ah*bh-p)+ah*bl+al*bh)+al*bl];
}
