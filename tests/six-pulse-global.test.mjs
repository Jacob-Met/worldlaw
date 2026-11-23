import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const source = 'examples/active-position-drift-six-pulse-tree.json';
const portfolio = 'examples/active-position-drift-six-pulse-global.json';

test('a changed initial pair replays from physical rows and detects swapped or forged records', () => {
  const code = `
import base64, copy, gzip, importlib.util, json, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location('global_receiver', 'scripts/verify-six-pulse-global.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
src = json.loads(Path(sys.argv[1]).read_text())
packet = v.load_portfolio(Path(sys.argv[2]))
ref = Path(sys.argv[2]).with_name('factored-feedback-six-ref-ref.jsonl')
assert v.receive(src, packet, ref, (0, 0))['lower'] == '1/20'
one = v.receive(src, packet, ref, (0, 1))
assert (one['scope'], one['lower'], one['upper'], one['physicalWorlds']) == ('selected-first-pair', '2/59', '2/59', 8192)
assert one['policy']['program']['commands'][:2] == ['ref', 'group']
from tempfile import TemporaryDirectory
from types import SimpleNamespace
runner_spec = importlib.util.spec_from_file_location('course','scripts/design-six-pulse-global.py')
course = importlib.util.module_from_spec(runner_spec)
runner_spec.loader.exec_module(course)
course.itertools = SimpleNamespace(product=lambda *a,**k: [(0,1)])
with TemporaryDirectory() as tmp:
    root = Path(tmp)
    compressed = base64.b64decode(packet['prefixes'][0]['gzipBase64'])
    (root/'0-1.jsonl.gz').write_bytes(compressed)
    course.run(src, root)
    saved = json.loads((root/'0-1.json').read_text())
    assert saved['result']['lower'] == '2/59' and saved['seconds'] is None
    assert saved['policy'] == one['policy']['program']
    course.run(src, root)
    assert (root/'0-1.jsonl.gz').read_bytes() == compressed


def reject(broken):
    try:
        v.receive(src, broken, ref, (0, 1))
    except (ValueError, StopIteration):
        return
    raise AssertionError('accepted a corrupted portfolio')

broken = copy.deepcopy(packet)
broken['prefixes'][0], broken['prefixes'][1] = broken['prefixes'][1], broken['prefixes'][0]
reject(broken)
broken = copy.deepcopy(packet)
broken['prefixes'][0]['gzipBase64'] = broken['prefixes'][1]['gzipBase64']
reject(broken)
broken = copy.deepcopy(packet)
row = broken['prefixes'][0]
lines = gzip.decompress(base64.b64decode(row['gzipBase64'])).decode().splitlines()
header = json.loads(lines[0])
header['lower'] = header['upper'] = '1/3'
lines[0] = json.dumps(header)
row['gzipBase64'] = base64.b64encode(gzip.compress(('\\n'.join(lines)+'\\n').encode())).decode()
reject(broken)
`;
  const run = spawnSync('python3', ['-c', code, source, portfolio], {encoding:'utf8'});
  assert.equal(run.status, 0, run.stderr);
});

test('bounded six-pulse search and the inherited five-pulse lower proof remain distinguishable', () => {
  const run = spawnSync('python3', ['scripts/verify-six-pulse-global.py', source, portfolio, '--prefix', 'y1', 'x1'], {encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.status,'bounded');
  assert.equal(result.lower,'1/38');
  assert.equal(result.upper,'1/20');
  assert.deepEqual(result.prefixes[0],{prefix:['y1','x1'],lower:'1/38',upper:'1/20',
    searchLower:'0',searchUpper:'1/16',retainedWords:3});
});
