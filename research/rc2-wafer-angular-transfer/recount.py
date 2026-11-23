"""Independent standard-library score of a frozen complex-ratio forecast."""
import cmath
import hashlib
import json
import math
import sys
from pathlib import Path

ARM_NAMES = ('sheet_two','bare','nominal_2nm','author_d','author_nd','common_additive',
             'extrapolate_additive','sheet_60')


def held_table(blob):
    assert hashlib.sha256(blob).hexdigest() == '00dab38092159f7c4fcbe137972f79ae578fbf3725557fcaa51b3f1e109fc43e'
    table = []
    for line in blob.decode('ascii').splitlines()[3:]:
        cells = line.split()
        if len(cells) != 7 or cells[0] != 'E' or float(cells[2]) != 50:
            continue
        wl = float(cells[1])/10
        if 210 <= wl <= 800:
            psi, delta = map(float,cells[3:5])
            table.append((wl, psi, delta))
    assert len(table) == 591 and all(x[0] < y[0] for x,y in zip(table,table[1:]))
    return table


def normalized(x, y):
    return abs(x-y)/(math.hypot(1,abs(x))*math.hypot(1,abs(y)))


def rms(v):
    return math.sqrt(math.fsum(x*x for x in v)/len(v))


def verify(raw, frozen, reported):
    table = held_table(raw)
    saved = json.loads(frozen)
    assert saved['wavelength_nm'] == [r[0] for r in table]
    assert set(saved['rho']) == set(ARM_NAMES)
    original = json.loads(reported)
    high = 0
    independent = {}
    for arm in ARM_NAMES:
        v = list(map(lambda xy: complex(*xy), saved['rho'][arm]))
        assert len(v) == len(table)
        errors = []
        groups = [[],[],[]]
        for (wl,p,d), forecast in zip(table,v):
            angle = -math.radians(d)
            truth = math.tan(math.radians(p))*complex(math.cos(angle),math.sin(angle))
            error = normalized(forecast,truth)
            errors.append(error)
            groups[0 if wl < 400 else 1 if wl < 600 else 2].append(error)
        obs = original['metrics'][arm]
        j = max(range(len(v)),key=errors.__getitem__)
        assert obs['worst']['index'] == j
        assert obs['worst']['wavelength_nm'] == table[j][0]
        assert obs['worst']['truth_degrees'] == list(table[j][1:])
        values = [rms(errors), max(map(rms,groups)), errors[j], *map(rms,groups)]
        independent[arm] = values[:2]
        report = [obs['rms'],obs['worst_region_rms'],obs['worst']['error'],*obs['region_rms']]
        high = max(high, max(abs(a-b) for a,b in zip(values,report)))
    independent_gates = [independent['sheet_two'][metric] < independent[arm][metric]
                         for arm in ARM_NAMES[1:] for metric in (0,1)]
    assert all(independent_gates)==original['joint_pass'] and high < 2e-12
    return {'arm_wavelength_errors': len(ARM_NAMES)*len(table),'max_abs_metric_error':high,
            'thresholds_passed':sum(independent_gates),'thresholds_total':len(independent_gates),
            'joint_pass':all(independent_gates), 'lock_sha256':hashlib.sha256(frozen).hexdigest(),
            'score_sha256':hashlib.sha256(reported).hexdigest()}


if __name__ == '__main__':
    print(json.dumps(verify(*(Path(p).read_bytes() for p in sys.argv[1:]))))
