"""Verify the published receipt archive and display its frozen prediction comparison."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXPECTED = {
    'estimation-clock-source.json': '8d9f8d70a61746230694db436b5b9cb061fa0dc38c416de11450febb66eae54a',
    'qualification.json': '7adbf09fc6c2b376b2bfdff191842b12447c83645626a0383f9746e0b7d217b9',
    'phase-control-development.json': '6dadf020a59370c6bd7702792882b0d5dd2185eb4971d3cf03992bce2e452432',
    'prediction-lock.json': '1ff22c83957d54a4fd58f444a880e4bf343d5fb5a8a7eb4ae56e644c5c114d11',
    'official-locked-scores.json': 'd258f743193f6fee84b088e087377c9416b440fd5e8764b8a1fb03c852c57270',
    'independent-physical-recount.json': 'c62e9266ea55b5977fbfc9cadcab10ca8948f0872b0613ab34a356ec510f2ee2',
}


def main():
    receipts = {}
    for name, digest in EXPECTED.items():
        raw = (HERE / 'receipts' / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError(f'Receipt hash mismatch: {name}')
        receipts[name] = raw
    report = json.loads(receipts['official-locked-scores.json'])
    recount = json.loads(receipts['independent-physical-recount.json'])
    lock = json.loads(receipts['prediction-lock.json'])
    required = {
        'official-locked-scores.json': recount['score_sha'],
        'prediction-lock.json': report['lock_sha'],
        'qualification.json': lock['qualified'],
    }
    for name, expected in required.items():
        if hashlib.sha256(receipts[name]).hexdigest() != expected:
            raise ValueError(f'Cross-receipt identity mismatch: {name}')
    if not (recount['pred_sha'] == report['prediction_sha'] == lock['predictions']):
        raise ValueError('Receivers refer to different prediction archives')
    if recount['scalars'] != 140 or recount['raw_worst_coordinates_verified'] != 35:
        raise ValueError('Incomplete recount')
    print('RMS input (V)    literal    direct    repeat    previous/current   [RMSE mV]')
    records = {(row['amp'],row['role']):row for row in report['rows']}
    for amp, value in enumerate([0.100, 0.325, 0.550, 0.775, 1.000]):
        scores = [records[amp, k]['rmse_mV'] for k in ('literal','direct','repeat','wrong')]
        print(f'{value:13.3f}' + ''.join(f'{score:10.4f}' for score in scores))
    print(f"Qualified amplitudes {sum(report['paired_wins'])}/5; independent recount {recount['scalars']} scalar errors")


if __name__ == '__main__':
    main()
