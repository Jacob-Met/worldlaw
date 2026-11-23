"""Angular transfer for an authenticated RC2 vendor acquisition."""
import argparse
import hashlib
import json
from pathlib import Path

import elli
import lmfit
import numpy as np

from sheet_limit import angular_factor, film_ratio

RAW_SHA = '00dab38092159f7c4fcbe137972f79ae578fbf3725557fcaa51b3f1e109fc43e'
TRAIN = (60, 70)
HELD = 50
ARMS = ('sheet_two', 'bare', 'nominal_2nm', 'author_d', 'author_nd',
        'common_additive', 'extrapolate_additive', 'sheet_60')


def project(path, permitted):
    source = Path(path).read_bytes()
    assert hashlib.sha256(source).hexdigest() == RAW_SHA
    rows = {angle: [] for angle in permitted}
    for line in source.splitlines()[3:]:
        cells = line.split()
        if not cells or cells[0] != b'E':
            continue
        angle = float(cells[2])
        if angle not in rows:
            continue
        wavelength = float(cells[1]) / 10
        if 210 <= wavelength <= 800:
            rows[angle].append((wavelength, float(cells[3]), float(cells[4])))
    arrays = {key: np.array(values) for key, values in rows.items()}
    axis = arrays[permitted[0]][:, 0]
    assert axis.size == 591 and np.all(np.diff(axis) > 0)
    for value in arrays.values():
        assert value.shape == (591, 3) and np.all(np.isfinite(value))
        assert np.array_equal(axis, value[:, 0])
    return axis, {key: values[:, 1:] for key, values in arrays.items()}


def observed_rho(data):
    return np.tan(np.deg2rad(data[:, 0])) * np.exp(-1j * np.deg2rad(data[:, 1]))


def pack(values):
    return [[float(x.real), float(x.imag)] for x in values]


def unpack(values):
    return np.array([complex(*pair) for pair in values])


def forward(wavelength, phi, pars, silicon):
    film = elli.Cauchy(pars['n0'], pars['n1'], 0, 0, 0, 0).get_mat()
    stack = elli.Structure(elli.AIR, [elli.Layer(film, pars['d'])], silicon)
    return stack.evaluate(wavelength, phi, solver=elli.Solver2x2)


def residual(parameters, wavelength, calib, silicon):
    out = []
    for phi in TRAIN:
        result = forward(wavelength, phi, parameters, silicon)
        out.extend([calib[phi][:, 0] - result.psi, calib[phi][:, 1] - result.delta])
    return np.concatenate(out)


def parameters(free):
    p = lmfit.Parameters()
    p.add('n0', value=1.452, min=-100, max=100, vary=free)
    p.add('n1', value=36, min=-40000, max=40000, vary=free)
    p.add('d', value=20, min=0, max=40000)
    return p


def predict(wavelength, calib):
    silicon = elli.db.RII().get_mat('Si', 'Aspnes')
    es = silicon.get_tensor(wavelength)[:, 0, 0]
    fixed = {'n0': 1.452, 'n1': 36, 'd': 0}
    bare = {phi: forward(wavelength, phi, fixed, silicon).rho for phi in (*TRAIN, HELD)}
    direct = np.array([film_ratio(e, 2.2, HELD, w, 0)
                       for e, w in zip(es, wavelength)])
    assert np.max(np.abs(direct - bare[HELD])) < 1e-10
    output = {'bare': bare[HELD], 'nominal_2nm': forward(
        wavelength, HELD, dict(fixed, d=2), silicon).rho}
    info = {}
    for label, free in [('author_d', False), ('author_nd', True)]:
        fit = lmfit.minimize(residual, parameters(free), method='leastsq',
                             args=(wavelength, calib, silicon))
        values = fit.params.valuesdict()
        assert fit.success, (label, fit.message)
        output[label] = forward(wavelength, HELD, values, silicon).rho
        info[label] = {'fit': values, 'nfev': fit.nfev, 'message': fit.message,
                       'calibration_raw_angle_rms': float(np.sqrt(np.mean(fit.residual**2)))}
        if free:
            columns = []
            for name, unit in [('n0', 1), ('n1', 36), ('d', 2)]:
                hi, lo = dict(values), dict(values)
                hi[name] += 1e-5 * unit
                lo[name] -= 1e-5 * unit
                columns.append((residual(hi, wavelength, calib, silicon) -
                                residual(lo, wavelength, calib, silicon)) / 2e-5)
            info[label]['jacobian_singular_values'] = np.linalg.svd(
                np.stack(columns, axis=1), compute_uv=False).tolist()
    deviations = np.array([observed_rho(calib[p]) - bare[p] for p in TRAIN])
    factors = np.array([[angular_factor(e, p) for e in es] for p in (*TRAIN, HELD)])
    a, b, target = factors
    denom = abs(a)**2 + abs(b)**2
    assert np.all(denom > 0) and np.all(abs(a) > 0)
    common = (np.conj(a)*deviations[0] + np.conj(b)*deviations[1]) / denom
    output.update(sheet_two=bare[HELD] + target*common,
                  sheet_60=bare[HELD] + target*deviations[0]/a,
                  common_additive=bare[HELD] + np.mean(deviations, axis=0),
                  extrapolate_additive=bare[HELD] + 2*deviations[0]-deviations[1])
    assert set(output) == set(ARMS) and all(np.isfinite(z).all() for z in output.values())
    info['sheet_source_consistency_rms'] = float(np.sqrt(np.mean(abs(
        deviations - factors[:2]*common)**2)))
    return {'wavelength_nm': wavelength.tolist(), 'rho': {k: pack(output[k]) for k in ARMS},
            'diagnostics': info, 'angular_factor_magnitudes': abs(factors[:2]).tolist(),
            'calibration': {str(p): v.tolist() for p,v in calib.items()}}


def score(wavelength, obs, lock):
    assert np.array_equal(wavelength, lock['wavelength_nm'])
    assert tuple(lock['rho']) == ARMS
    truth = observed_rho(obs)
    result = {}
    for key in ARMS:
        pred = unpack(lock['rho'][key])
        error = abs(pred-truth) / np.sqrt((1+abs(pred)**2)*(1+abs(truth)**2))
        regions = [(wavelength<400), (wavelength>=400)&(wavelength<600), (wavelength>=600)]
        rms = [float(np.sqrt(np.mean(error[mask]**2))) for mask in regions]
        i = int(np.argmax(error))
        result[key] = {'rms': float(np.sqrt(np.mean(error**2))), 'region_rms': rms,
                       'worst_region_rms': max(rms), 'worst': {
                           'index': i, 'wavelength_nm': float(wavelength[i]),
                           'error': float(error[i]), 'truth_rho': pack([truth[i]])[0],
                           'pred_rho': pack([pred[i]])[0], 'truth_degrees': obs[i].tolist(),
                           'pred_degrees': [float(np.rad2deg(np.arctan(abs(pred[i])))),
                                            float(-np.angle(pred[i], deg=True))],
                           'jones_norms': [float(np.sqrt(1+abs(z)**2)) for z in (pred[i],truth[i])],
                           'ratio_phase_diff_rad': float(np.angle(pred[i]*truth[i].conj())),
                           'source_psi_delta': {p:v[i] for p,v in lock['calibration'].items()}}}
    margins = {key: {gate: result[key][gate] - result['sheet_two'][gate]
                      for gate in ('rms','worst_region_rms')} for key in ARMS[1:]}
    return {'metrics': result, 'margins': margins,
            'joint_pass': all(x > 0 for pair in margins.values() for x in pair.values())}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('phase', choices=['predict','score'])
    parser.add_argument('raw')
    parser.add_argument('lock')
    options = parser.parse_args()
    if options.phase == 'predict':
        axis, source = project(options.raw, TRAIN)
        payload = json.dumps(predict(axis, source), allow_nan=False,
                             separators=(',',':')).encode()
        with open(options.lock,'xb') as f:
            f.write(payload)
        print('Forecast lock',len(payload),hashlib.sha256(payload).hexdigest())
    else:
        axis, held = project(options.raw, (HELD,))
        print(json.dumps(score(axis, held[HELD], json.loads(Path(options.lock).read_bytes())),
                         allow_nan=False))
