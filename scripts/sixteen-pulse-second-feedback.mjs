import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const commands = ['ref', 'group', 'x0', 'y0', 'z0', 'x1', 'y1', 'z1'];
const fail = message => { throw new Error(message); };
const abs = x => x < 0n ? -x : x;
function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return abs(a);
}
function rational(input) {
  if (typeof input !== 'string' || !/^-?\d+(?:\/[1-9]\d*)?$/.test(input)) fail('Expected an exact rational string');
  const [a, b = '1'] = input.split('/');
  return [BigInt(a), BigInt(b)];
}
function format(a, b) {
  const g = gcd(a, b);
  return b === g ? String(a / g) : String(a / g) + '/' + String(b / g);
}
function world(raw, row, ninth, tenth, c) {
  if (row.length !== 10) fail('Expected two mixtures, positions and drifts');
  const fractions = [...row, ninth, tenth].map(rational);
  const d = fractions.reduce((s, [, b]) => s / gcd(s, b) * b, 32n);
  const x = fractions.map(([a, b]) => a * (d / b));
  const e = 5n * d / 32n;
  const laws = raw.map(({vertices}, l) => {
    const weights = x.slice(3*l, 3*l+3);
    weights.push(d - weights.reduce((a, b) => a + b, 0n));
    if (weights.some(w => w < 0n)) fail('Negative mixture mass');
    const origin = x[6+2*l], drift = x[7+2*l];
    const rates = commands.map((_, j) => weights.reduce((s, w, i) => s + w * BigInt(vertices[i][j]), drift));
    const referenceEnd = origin + 8n*rates[0], afterNinth = referenceEnd + rates[2], start = afterNinth + rates[c];
    if (abs(origin) > e || abs(referenceEnd) > e || abs(afterNinth - x[10]) > e || abs(start - x[11]) > e)
      fail('Physical state misses a previously issued reading');
    return {weights, origin, drift, rates, start};
  });
  const start = laws[0].start - laws[1].start;
  const gaps = laws[0].rates.map((a, j) => a - laws[1].rates[j]);
  function covers(tail) {
    let lo = start, hi = start;
    for (const j of tail) {
      const delta = gaps[j];
      if (delta < 0n) lo += delta;
      else hi += delta;
    }
    return lo >= -2n*e && hi <= 2n*e;
  }
  function replay(tail) {
    const pos = laws.map(l => l.start);
    const readings = [...Array(9).fill('0'), ninth, tenth];
    for (const j of tail) {
      pos[0] += laws[0].rates[j]; pos[1] += laws[1].rates[j];
      if (abs(pos[0] - pos[1]) > 2n*e) fail('Terminal replay exceeds the noise budget');
      readings.push(format(pos[0] + pos[1], 2n*d));
    }
    return {readings, laws:laws.map(l => ({
      weights:l.weights.map(a => format(a, d)), origin:format(l.origin, d), drift:format(l.drift, d)
    }))};
  }
  return {covers, replay};
}

export function receiver(source, packet) {
  const raw = source.catalog;
  if (JSON.stringify(raw.commands) !== JSON.stringify(commands) ||
      raw.laws.length !== 2 || raw.laws.some(l => l.vertices.length !== 4 ||
        l.vertices.some(v => v.length !== 8 || !v.every(Number.isSafeInteger)))) fail('Unexpected source catalogue');
  if (packet.schema !== 'worldlaw.sixteen-pulse-second-feedback/v1' || packet.ninth !== '27/128' ||
      packet.children.length !== commands.length) fail('Unexpected feedback packet');
  const tables = packet.children.map((child, i) => {
    if (child.command !== commands[i] || !child.worlds.length) fail('Missing tenth-command branch');
    return child.worlds.map(row => world(raw.laws, row, packet.ninth, child.reading, i));
  });
  function commandIndex(name) {
    const i = commands.indexOf(name);
    if (i < 0) fail('Unknown command: ' + name);
    return i;
  }
  function respond(tenth, tail) {
    if (tenth === undefined) {
      if (tail !== undefined) fail('Select the tenth command first');
      return {ninth:packet.ninth};
    }
    const c = commandIndex(tenth);
    const prefix = {ninth:packet.ninth, tenth:packet.children[c].reading};
    if (tail === undefined) return prefix;
    if (!Array.isArray(tail) || tail.length !== 6) fail('Commit a complete six-command tail');
    const indices = tail.map(commandIndex);
    const witness = tables[c].find(w => w.covers(indices));
    if (!witness) fail('No physical world pair covers the committed tail');
    return {...prefix, ...witness.replay(indices)};
  }
  function verify() {
    let cases = 0;
    function visit(tail, first) {
      if (tail.length === 6) {
        for (const list of tables) {
          if (!list.some(w => w.covers(tail))) fail('Uncovered tail ' + tail.join(','));
          cases++;
        }
        return;
      }
      for (let j = first; j < commands.length; j++) visit([...tail, j], j);
    }
    visit([], 0);
    return {cases, physicalPairs:tables.reduce((s, t) => s + t.length, 0)};
  }
  return {respond, verify};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const load = name => JSON.parse(readFileSync(new URL('../examples/' + name, import.meta.url), 'utf8'));
  const r = receiver(load('active-position-drift-sixteen-pulse-upper.json'), load('sixteen-pulse-second-feedback.json'));
  const args = process.argv.slice(2);
  if (args[0] === '--verify' && args.length !== 1) fail('Verification accepts no commands');
  const value = args[0] === '--verify' ? r.verify() : r.respond(args[0], args.length > 1 ? args.slice(1) : undefined);
  process.stdout.write(JSON.stringify(value) + '\n');
}
