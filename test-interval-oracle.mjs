import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {screenIntervalRefinement as score} from './src/unknown-lab/reference-interval-refinement.mjs';
const cases=JSON.parse(readFileSync(new URL('./interval-oracle-controls.json',import.meta.url))).cases;
for(const c of cases){const r=score(c.parts,c.signs,c.u,c.v,c.rho,c.epsilon);assert.equal(r.status,'computed',JSON.stringify({c,r}));assert(Math.abs(r.worstRemainingWidth-c.expectedWidth)<=r.numericalGuard,JSON.stringify({c,r}));}
console.log('PASS '+cases.length+' independent exact stored-value generic four-dimensional oracle comparisons.');
