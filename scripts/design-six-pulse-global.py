"""Run the 63 remaining grouped six-pulse prefixes sequentially, checkpointing verified proofs."""
import gzip
import hashlib
import importlib.util
import itertools
import json
import os
import sys
import tempfile
import time
from fractions import Fraction
from pathlib import Path


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


def encode(value):
    return json.dumps(value, separators=(',', ':'))


def atomic(path, data):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
        temp = f.name
    os.replace(temp, path)


def run(source, output):
    solver = module('design-factored-feedback')
    verifier = module('verify-factored-feedback')
    commands = source['catalog']['commands']
    law_ids = [law['id'] for law in source['catalog']['laws']]
    vertices = [[[verifier.rational(x) for x in row] for row in law['vertices']] for law in source['catalog']['laws']]
    vertices = [[[int(x) if x.denominator == 1 else x for x in row] for row in vs] for vs in vertices]
    weights = [['1/6','1/3','1/6','1/3'], ['1/2','1/6','1/6','1/6']]
    h, split = 6, 5
    fixed = solver.fixed_mixture_bound(vertices, weights, h)
    assert fixed[0] == Fraction(1, 16)
    output.mkdir(exist_ok=True)
    for p in itertools.product(range(len(commands)), repeat=2):
        if p == (0, 0):
            continue
        name = str(p[0]) + '-' + str(p[1])
        path = output / (name + '.jsonl.gz')
        meta = output / (name + '.json')
        if path.exists():
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            with gzip.open(path, mode='rt') as stream:
                checked = verifier.verify(source, stream, True, [commands[i] for i in p], h, True)
            policy = checked.pop('policy')
            if meta.exists():
                saved = json.loads(meta.read_text())
                if (digest != saved['gzipSha256'] or checked != saved['result'] or
                        policy['program'] != saved['policy'] or saved['prefix'] != list(p)):
                    raise ValueError('changed verified checkpoint')
            else:
                # The proof is committed before its metrics. Recover the scientific result
                # even if a crash interrupted that second write; no prefix is refitted.
                saved = dict(prefix=list(p), result=checked, policy=policy['program'],
                             design=None, seconds=None, gzipSha256=digest)
                atomic(meta, (encode(saved)+'\n').encode())
            continue
        start = time.monotonic()
        summary, data = solver.design(vertices, p, h, None, 32, split, 512, 8, mixture_bound=fixed)
        design_seconds = time.monotonic()-start
        plan = dict(prefix=list(p), horizon=h, split=split, words=None)
        start = time.monotonic()
        def export():
            return ('\n'.join(encode(line) for line in solver.proof_lines(commands, law_ids, vertices, plan, data, summary))+'\n').encode()
        try:
            raw = export()
        except solver.UnverifiedProposal as err:
            # Preserve the already proved lower; use the universal physical midpoint upper.
            prefixes, outer, _, active = data[:4]
            values = [Fraction(0)]*len(outer)
            for key, i in outer.items():
                if key != 'e': values[i] = solver.midpoint_reading(key[1], fixed[1])
            summary['upper'] = str(fixed[0])
            summary['status'] = 'exact' if summary['lower'] == summary['upper'] else 'bounded'
            summary['exportNumericalStop'] = str(err)
            data = (prefixes, outer, (fixed[0],values), active, fixed)
            raw = export()
        export_seconds = time.monotonic()-start
        start = time.monotonic()
        result = verifier.verify(source, iter(raw.decode().splitlines()), True, [commands[i] for i in p], h, True)
        replay_seconds = time.monotonic()-start
        policy = result.pop('policy')
        blob = gzip.compress(raw, compresslevel=6, mtime=0)
        record = dict(prefix=list(p), result=result, policy=policy['program'], design=summary,
                      seconds=dict(design=design_seconds, export=export_seconds, replay=replay_seconds),
                      gzipSha256=hashlib.sha256(blob).hexdigest(), rawBytes=len(raw))
        atomic(path, blob)
        atomic(meta, (encode(record)+'\n').encode())
        print(name,result['lower'],result['upper'], len(summary['history']), flush=True)


if __name__ == '__main__':
    run(json.loads(Path(sys.argv[1]).read_text()), Path(sys.argv[2]))
