"""Fit on 00–11, then project only E1/E5a for the development forecast."""
import argparse
import json
from pathlib import Path
import numpy as np
from projection import CODES, authenticate, clean, dump, endpoints, projected, read

Q = 1381457 / 12173057
ARMS = ('nearest_a', 'own_first_order', 'average_slope', 'iid_corrected',
        'differential_fit', 'symmetric_fit', 'affine_ls', 'affine_huber')

def coordinates(data):
    raw = np.asarray(data, dtype=float).reshape(-1, 2, 2)
    own = raw[:, :, 1]
    diff = raw[:, :, 0] - own
    return own, np.column_stack((own.mean(1), (own[:, 0] - own[:, 1])/2,
                                  diff.mean(1), (diff[:, 0] - diff[:, 1])/2))

def fit(inputs, target):
    own, x = coordinates(inputs)
    y = np.asarray(target) - own
    center = x.mean(0)
    scale = x.std(0)
    scale[scale == 0] = 1
    matrix = np.column_stack([np.ones(len(y)), (x-center)/scale])
    coef, _, rank, singular = np.linalg.lstsq(matrix, y, rcond=1e-12)
    v = np.linalg.lstsq(x[:, 2:3], y.mean(1), rcond=1e-12)[0][0]
    w = np.linalg.lstsq(x[:, 3:4], (y[:, 0]-y[:, 1])/2, rcond=1e-12)[0][0]
    residual = y-matrix@coef
    thresholds = np.maximum(.001, 1.345*1.4826*np.median(abs(residual-np.median(residual,axis=0)),axis=0))
    robust = coef.copy()
    for i in range(2):
        for _ in range(20):
            error = abs(y[:, i] - matrix @ robust[:, i])
            weight = np.sqrt(thresholds[i]/np.maximum(error, thresholds[i]))
            robust[:, i] = np.linalg.lstsq(matrix*weight[:, None], y[:, i]*weight, rcond=1e-12)[0]
    return dict(v=float(v), w=float(w), center=center.tolist(),scale=scale.tolist(), rank=int(rank),
                singular=singular.tolist(), coef=coef.tolist(), robust=robust.tolist(), thresholds=thresholds.tolist())

def predict(inputs, model):
    own, x = coordinates(inputs)
    m = x[:, 2:3]
    d = x[:, 3:4] * np.array([1., -1.])
    design = np.column_stack([np.ones(len(x)),(x-model['center'])/model['scale']])
    return np.stack([own,own+Q*(m+d),own+Q*m,own+Q*m+.5*d,own+Q*m+model['w']*d,
                     own+model['v']*m+model['w']*d,own+design@model['coef'],own+design@model['robust']],axis=1)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archives', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--development-proof',type=Path,help='required for final hours')
    args = parser.parse_args()
    if args.development_proof and not read(args.development_proof)['joint_pass']:
        raise ValueError('development gate failed')
    authenticate(args.archives)
    train_x, train_y, counts = [], [], {}
    for hour in range(12):
        seen = donors = scoreable = 0
        for key,cells in projected(args.archives,hour,CODES):
            seen += 1
            if not clean(cells,CODES[:2]):
                continue
            donors += 1
            y = [r[0] for r in endpoints(cells,CODES[2:])]
            if None not in y:
                train_x.append(endpoints(cells,CODES[:2]))
                train_y.append(y)
                scoreable += 1
        counts[hour] = {'nominal':59*99,'seen':seen,'donors':donors,'paired_targets':scoreable}
        print('TRAIN',hour,counts[hour],flush=True)
    model = fit(train_x,train_y)
    rows, ledger = [], []
    first = 18 if args.development_proof else 12
    for hour in range(first,first+6):
        for key,cells in projected(args.archives,hour,CODES[:2]):
            ledger.append([list(key),cells])
            if clean(cells,CODES[:2]):
                rows.append([list(key),endpoints(cells,CODES[:2])])
    pred = predict([row[1] for row in rows],model).tolist()
    bank = dict(stage='final' if first==18 else 'development',hours=list(range(first,first+6)),
                arms=list(ARMS),model=model,training_counts=counts,donor_roster=ledger,
                rows=[row+[p] for row,p in zip(rows,pred)])
    print('FORECAST_LOCK',json.dumps(dump(args.output,bank),sort_keys=True),flush=True)
    print('TRAIN_MODEL',json.dumps(model,sort_keys=True),'ELIGIBLE',len(rows),'SEEN',len(ledger))
if __name__ == '__main__':
    main()
