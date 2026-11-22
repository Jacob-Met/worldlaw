"""Verify the published receipt archive and display its frozen prediction comparison."""
import hashlib
import io
import json
from pathlib import Path
import zipfile

HERE = Path(__file__).resolve().parent
ARCHIVE = '402c821dd1890be359b5ca99728fbcda571d2e99309e77f8c35869196ac8e756'


def main():
    raw = (HERE / 'aggregate-receipts.zip').read_bytes()
    if hashlib.sha256(raw).hexdigest() != ARCHIVE:
        raise ValueError('Receipt archive hash mismatch')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        receipts = {name: archive.read(name) for name in archive.namelist()}
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
