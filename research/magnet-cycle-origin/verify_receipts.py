"""Verify the complete registered output evidence using only the Python standard library."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RECEIPTS = ROOT / 'receipts'
MATERIALS = 'ABCDE'
ROWS = [7651, 3172, 5357, 7299, 3738]


def load_receipt(name):
    return json.loads((RECEIPTS / name).read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    identities = json.loads((ROOT / 'receipt-identities.json').read_text())
    for name, expected in identities.items():
        if Path(name).name != name or digest(RECEIPTS / name) != expected:
            raise ValueError(f'Receipt identity mismatch for {name}')
    lock = load_receipt('prediction-lock.json')
    scores = load_receipt('score.json')
    check = load_receipt('recount.json')
    public = load_receipt('official-gate.json')
    assert not scores['errors'] and len(scores['historic']) == 23
    assert all(set(table) == set(MATERIALS) for table in scores['historic'].values())
    assert public['literal_printed_metrics_checked'] == 620
    assert public['model_count'] == 31 and public['material_groups'] == 155
    assert public['organizer_blob'] == '2b86d8f139429f13e4aef01c27202be262927de1'
    assert check['matched_stats'] == 160 and check['matched_worsts'] == 40
    assert check['max_abs_recount_difference_pp'] < 1e-10
    assert check['robustness_gate'] and not check['ordinary_source_gate'] and not check['full_gate']
    for letter, rows in zip(MATERIALS, ROWS):
        name = f'forecast-{letter}.json'
        receipt = load_receipt(name)
        assert digest(RECEIPTS / name) == lock[letter]['json']
        assert receipt['hash'] == lock[letter]['npz']
        assert receipt['rows'] == rows and not receipt['test_H_loss_opened']
        assert receipt['phase_input_byte_equality_verified'] == {'voltage': rows, 'field': rows}
        assert len(scores['candidates'][letter]) == 8
        assert all(s['rows'] == rows for s in scores['candidates'][letter].values())
        assert not any(s.get('missing_native_columns') for s in receipt['logged'].values())
    original = 'winner_original'
    canonical = 'winner_voltage'
    means = check['aggregate_mean_P95_pct']
    assert means[canonical] > means[original]
    for role, published in means.items():
        per_material = [scores['candidates'][m][role]['p95'] for m in MATERIALS]
        assert abs(sum(per_material)/5 - published) < 1e-10
    ranking = sorted((sum(s['p95'] for s in table.values())/5,t) for t,table in scores['historic'].items())
    assert ranking[0][1] == 'Bristol' and ranking[1][1] == 'Paderborn'
    print(f'Verified {sum(ROWS):,} cycles, 40 arrays, 23 archived entrants, 620 organizer metrics and 40 independent worst rows.')


if __name__ == '__main__':
    main()
