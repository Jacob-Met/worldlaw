"""Compare two factored solvers on the frozen five-pulse course."""
import argparse, importlib.util, json, time
from pathlib import Path

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def measure(module, receiver, source, prefix, horizon, words):
    catalog = source['catalog']
    commands = catalog['commands']
    vertices = [law['vertices'] for law in catalog['laws']]
    start = time.monotonic()
    summary, data = module.design(vertices, prefix, horizon, words, 32)
    design_seconds = time.monotonic() - start
    split = max(len(prefix), horizon - 1)
    plan = dict(prefix=list(prefix), horizon=horizon, split=split, words=words)
    if words is not None:
        plan['words'] = [list(w) for w in words]
    ids = [law['id'] for law in catalog['laws']]
    start = time.monotonic()
    stream = (json.dumps(line, separators=(',', ':')) for line in module.proof_lines(commands, ids, vertices, plan, data, summary))
    received = receiver.verify(source, stream, words is None, [commands[i] for i in prefix] if words is None else None, horizon if words is None else None)
    return dict(received=received, stats=summary['stats'], export=summary['export'], rounds=len(summary['history']), designSeconds=round(design_seconds, 4), exportSeconds=round(time.monotonic() - start, 4))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference', required=True, type=Path)
    parser.add_argument('--implementation', default=Path(__file__).with_name('design-factored-feedback.py'), type=Path)
    parser.add_argument('--prefixes', nargs='*', help='index pairs; default all 64 plus six')
    args = parser.parse_args()
    old = load_module('old_factored', args.reference)
    candidate = load_module('new_factored', args.implementation)
    receiver = load_module('physical_receiver', Path(__file__).with_name('verify-factored-feedback.py'))
    root = Path(__file__).resolve().parent.parent
    five = json.loads((root / 'examples/active-position-drift-five-pulse-minimum.json').read_text())
    six = json.loads((root / 'examples/active-position-drift-six-pulse-tree.json').read_text())
    for k, tag in enumerate(args.prefixes or [str(i) + str(j) for i in range(8) for j in range(8)] + ['six']):
        if tag == 'six':
            source = six
            prefix, h, words = receiver.source_tree(six, False, None, None)
        else:
            source = five
            prefix = tuple(map(int, tag))
            h = 5
            words = None
        result = {'prefix': tag}
        pair = [('reference', old), ('candidate', candidate)]
        for key, model in pair if k % 2 == 0 else reversed(pair):
            result[key] = measure(model, receiver, source, prefix, h, words)
        if any((result['reference']['received'][key] != result['candidate']['received'][key] for key in ('lower', 'upper', 'status'))):
            result['mismatch'] = True
        print(json.dumps(result, separators=(',', ':')), flush=True)
if __name__ == '__main__':
    main()
