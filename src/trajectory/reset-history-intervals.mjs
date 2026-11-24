/** Two leading fitted laws choose an equal-power drive. */
import { rankObserved } from './noisy-field-intervention.mjs';
import { N, rollout } from './field-law-dictionary.mjs';

export function contenderDesign(pilot) {
  const leaders = rankObserved([pilot]).slice(0, 2);
  const scores = [];
  for (let drive = 0; drive < 8; drive++) {
    const paths = leaders.map(c => rollout(c.law, c.coef, pilot.values[0], drive));
    let separation = 0;
    if (paths.every(Boolean)) {
      let count = 0;
      for (let t = 4; t <= N; t += 4) {
        for (let k = 0; k < pilot.sigma.length; k++) {
          separation += ((paths[0][t][k] - paths[1][t][k]) / pilot.sigma[k]) ** 2;
          count++;
        }
      }
      separation /= count;
    }
    if (!Number.isFinite(separation)) throw new RangeError('nonfinite forecast separation');
    scores.push({drive, separation});
  }
  scores.sort((a,b) => b.separation-a.separation || a.drive-b.drive);
  return {drive:scores[0].drive,committee:leaders.map(c=>c.law),scores};
}

/** The caller establishes the physical reset and forcing identities and supplies
 * conservative absolute bounds. Intersecting intervals leave the test inconclusive. */
export function compareResetHistories(a,b) {
  function validate(r) {
    if (!r || typeof r.reset!=='string' || !r.reset || typeof r.forcing!=='string' ||
        !r.forcing || typeof r.preparation!=='string' || !r.preparation ||
        !Array.isArray(r.time) || !r.time.length || !Array.isArray(r.values) ||
        r.time.length!==r.values.length || !Array.isArray(r.bounds) || !r.bounds.length ||
        r.bounds.some(x=>!Number.isFinite(x)||x<0)) throw new TypeError('incomplete reset recording');
    for(let i=0;i<r.time.length;i++) {
      if(!Number.isFinite(r.time[i])||(i&&r.time[i]<=r.time[i-1])||
        !Array.isArray(r.values[i])||r.values[i].length!==r.bounds.length||
        r.values[i].some(x=>!Number.isFinite(x))) throw new TypeError('invalid reset recording');
    }
  }
  validate(a);validate(b);
  if(a.reset!==b.reset||a.forcing!==b.forcing||a.preparation===b.preparation||
      a.bounds.length!==b.bounds.length||a.time.length!==b.time.length||
      a.time.some((t,i)=>t!==b.time[i])) throw new Error('incomparable reset histories');
  let maximumGap=-Infinity,witness=null;
  for(let i=0;i<a.time.length;i++) {
    for(let k=0;k<a.bounds.length;k++) {
      const left=a.values[i][k],right=b.values[i][k];
      const totalBound=a.bounds[k]+b.bounds[k],distance=Math.abs(left-right);
      if(!Number.isFinite(distance)||!Number.isFinite(totalBound)) throw new RangeError('interval overflow');
      const guard=64*Number.EPSILON*Math.max(1,Math.abs(left),Math.abs(right),totalBound);
      const gap=distance-totalBound-guard;
      maximumGap=Math.max(maximumGap,gap);
      if(gap>0&&(!witness||gap>witness.gap)) witness={time:a.time[i],channel:k,left,right,leftBound:a.bounds[k],rightBound:b.bounds[k],guard,gap};
    }
  }
  return {contradiction:witness!==null,maximumGap,witness};
}
