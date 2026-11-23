import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const names = ['ref','group','x0','y0','z0','x1','y1','z1'];
const nominalTwelfths = [0,6,3,1,-1,3,1,-1];
const opening = [6,3,4,4,2,5,7,2];
const requireValue = (value, message) => { if (!value) throw new Error(message); };
function fraction(n, d) {
  let a = n < 0n ? -n : n, b = d;
  while (b) [a,b] = [b,a%b];
  return a === d ? String(n/d) : String(n/a) + '/' + String(d/a);
}
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function decodePair(row, laws) {
  requireValue(row.length === 11 && row.every(Number.isSafeInteger), 'Invalid source witness');
  const [unit,...n] = row.map(BigInt);
  requireValue(unit > 0n && unit % 288n === 0n, 'Invalid rational unit');
  const epsilon = 5n*unit/32n, shift = -unit/18n;
  const nominal = nominalTwelfths.map(a => BigInt(a)*unit/12n);
  const states = laws.map((law,l) => {
    const weights = n.slice(3*l,3*l+3);
    weights.push(unit - weights.reduce((s,w) => s+w,0n));
    requireValue(weights.every(w => w >= 0n), 'Negative vertex weight');
    const origin = n[6+2*l], drift = n[7+2*l];
    const rates = names.map((_,c) => weights.reduce((s,w,i) => s + w*BigInt(law.vertices[i][c]), drift));
    let error = origin;
    requireValue(error >= -epsilon && error <= epsilon, 'Invalid initial position');
    for (const [i,c] of opening.entries()) {
      error += rates[c] - nominal[c];
      if (i === 7) error -= shift;
      requireValue(error >= -epsilon && error <= epsilon, 'Invalid opening trajectory');
    }
    return {law:law.id, origin, drift, weights, rates, error};
  });
  function covers(remaining, last) {
    // The last command is known privately when validating this completed word.
    // All permutations of the other seven use the prescribed nominal display.
    const terminal = [];
    for (const state of states) {
      let lo = state.error, hi = state.error, end = state.error;
      for (let c = 0; c < names.length; c++) {
        const delta = state.rates[c] - nominal[c];
        const count = BigInt(remaining[c]);
        if (delta < 0n) lo += count*delta;
        else hi += count*delta;
        end += count*delta;
      }
      if (lo < -epsilon || hi > epsilon) return false;
      terminal.push(end + state.rates[last] - nominal[last]);
    }
    const difference = terminal[0]-terminal[1];
    return difference >= -2n*epsilon && difference <= 2n*epsilon;
  }
  function replay(word) {
    const pos = states.map(s => s.origin);
    let center = 0n;
    const readings = [];
    for (let t = 0; t <= word.length; t++) {
      if (t) {
        const c = word[t-1];
        for (let l = 0; l < 2; l++) pos[l] += states[l].rates[c];
        center += nominal[c];
        if (t === 8) center += shift;
      }
      const doubled = t === 16 ? pos[0]+pos[1] : 2n*center;
      requireValue(pos.every(p => 2n*p-doubled >= -2n*epsilon && 2n*p-doubled <= 2n*epsilon),
                   'Measured trajectory exceeds the noise budget');
      readings.push(fraction(doubled,2n*unit));
    }
    return {readings, worlds:states.map(s => ({
      law:s.law, weights:s.weights.map(w => fraction(w,unit)), origin:fraction(s.origin,unit), drift:fraction(s.drift,unit)
    }))};
  }
  return {covers,replay};
}

export function checkReordering(catalog, reordered) {
  const changed = [2,3,4,4,5,6,7,2];
  requireValue(same(reordered.opening, changed), 'Unexpected reordered word');
  const word = [...changed,...Array(8).fill(0)];
  const expected = [[6,50,'4/25'],[7,58,'14/87']];
  requireValue(reordered.certificates.length === 2, 'Missing original-position dual');
  for (const [k,cert] of reordered.certificates.entries()) {
    requireValue(same([cert.nominalThrough,cert.noiseWeight,cert.lower],expected[k]), 'Unexpected dual scope');
    const columns = Array(13).fill(0n);
    let rhs12 = 0n;
    for (const [[t,l,sign],numerator] of cert.weights) {
      requireValue(Number.isSafeInteger(numerator) && numerator > 0 && (sign === -1 || sign === 1), 'Invalid dual multiplier');
      const scale = BigInt(numerator), signed = BigInt(sign)*scale;
      if (t === 'mass') {
        requireValue(l === 0 || l === 1, 'Unknown mixture');
        for (let i = 0; i < 4; i++) columns[4*l+i] += signed;
        rhs12 += 12n*signed;
        continue;
      }
      requireValue(Number.isInteger(t) && t >= 0 && t <= 16 && [0,1,2].includes(l), 'Invalid position row');
      const counts = Array(8).fill(0);
      for (const c of word.slice(0,t)) counts[c]++;
      for (const a of l === 2 ? [0,1] : [l]) {
        const w = a === 1 && l === 2 ? -signed : signed;
        catalog.laws[a].vertices.forEach((row,i) => {
          columns[4*a+i] += w*row.reduce((s,v,j) => s + BigInt(v)*BigInt(counts[j]),0n);
        });
        columns[8+2*a] += w;
        columns[9+2*a] += w*BigInt(t);
      }
      columns[12] -= scale*(l === 2 ? 2n : 1n);
      if (l !== 2) {
        requireValue(t <= cert.nominalThrough, 'Dual refers to a later displayed reading');
        rhs12 += signed*counts.reduce((s,v,j) => s + BigInt(v*nominalTwelfths[j]),0n);
      }
    }
    requireValue(columns.slice(0,12).every(v => v === 0n) &&
      columns[12] === -BigInt(cert.noiseWeight) && fraction(-rhs12,-12n*columns[12]) === cert.lower,
      'Original-coordinate dual does not cancel');
  }
  return expected.map(([, , lower]) => lower);
}

export function suffixFirstReceiver(source, packet) {
  const cat=source.catalog;
  requireValue(same(cat.commands,names) && same(cat.laws.map(l => l.id),['A','B']) &&
    cat.laws.every(l => l.vertices.length === 4 && l.vertices.every(v => v.length === 8 && v.every(Number.isSafeInteger))),
    'Unexpected original catalogue');
  requireValue(packet.schema === 'worldlaw.sixteen-pulse-suffix-first/v1' && same(packet.opening,opening) &&
    packet.noise === '5/32' && packet.shift === '-1/18','Unexpected feedback certificate');
  const pairs=packet.pairs.map(row => decodePair(row,cat.laws));
  const entries=Buffer.from(packet.assignments,'base64'), splits=new Map(packet.terminalSplits);
  const histograms=[], ranks=new Map();
  function enumerate(i,n,h) {
    if (i === 7) {
      const counts=[...h,n];
      ranks.set(counts.join(','),histograms.length);
      histograms.push(counts);
    } else for (let k=n;k>=0;k--) enumerate(i+1,n-k,[...h,k]);
  }
  enumerate(0,8,[]);
  requireValue(entries.length === histograms.length && splits.size === packet.terminalSplits.length, 'Invalid histogram table');
  const splitCount = entries.reduce((s,v) => s + Number(v === 255),0);
  requireValue(splitCount === splits.size && [...splits.keys()].every(i => entries[i] === 255), 'Invalid split keys');
  function pick(i,last) {
    let id=entries[i];
    if (id === 255) id=splits.get(i)?.[last];
    requireValue(Number.isInteger(id) && id >= 0 && id < pairs.length, 'Missing physical pair');
    return pairs[id];
  }
  function verify() {
    for (const [i,h] of histograms.entries()) {
      for (let last=0;last<8;last++) if (h[last]) {
        const remaining=h.slice(); remaining[last]--;
        requireValue(pick(i,last).covers(remaining,last), 'Uncovered original-word continuation');
      }
    }
    return {histograms:histograms.length, orderedTails:8**8, pairs:pairs.length,
            splitHistograms:splitCount,reorderedLowerBounds:checkReordering(cat,packet.reordered)};
  }
  function receive(commands) {
    requireValue(Array.isArray(commands) && commands.length <= 16, 'Supply at most sixteen commands');
    const word=commands.map(c => names.indexOf(c));
    requireValue(word.every((c,i) => c >= 0 && (i >= 8 || c === opening[i])), 'Commands differ from the certified opening');
    // Complete a partial transcript privately. Its displayed values are a function of the observed prefix alone.
    const tail=[...word.slice(8),...Array(8-Math.max(0,word.length-8)).fill(0)];
    const h=Array(8).fill(0); for (const c of tail) h[c]++;
    return pick(ranks.get(h.join(',')),tail[7]).replay(word);
  }
  return {verify,receive};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const read=name => JSON.parse(readFileSync(new URL('../examples/'+name,import.meta.url),'utf8'));
  const receiver=suffixFirstReceiver(read('active-position-drift-sixteen-pulse-upper.json'),read('sixteen-pulse-suffix-first.json'));
  const args=process.argv.slice(2);
  const result=args.length === 1 && args[0] === '--verify' ? receiver.verify() : receiver.receive(args);
  process.stdout.write(JSON.stringify(result)+'\n');
}
