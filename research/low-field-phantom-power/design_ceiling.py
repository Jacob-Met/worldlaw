"""Compute a finite design-grid sensitivity for the released nominal scan schedules."""
import json
import numpy as np
from scipy.optimize import least_squares

HIGH = np.deg2rad([5.4772, 9.6549, 17.019, 30.])
LOW = np.deg2rad([1., 1.7627, 3.1072])
NOMINAL_AFI = np.deg2rad(60.)


def spgr(angle, relaxation, field):
    e = np.exp(-.023 / relaxation)
    return np.sin(angle * field) * (1. - e) / (1. - e * np.cos(angle * field))


def afi_ratio(relaxation, field):
    e1, e2 = np.exp(-np.array([.032, .096]) / relaxation)
    c = np.cos(NOMINAL_AFI * field)
    before_first = (1. - e2 + e2*c*(1. - e1)) / (1. - e1*e2*c*c)
    before_second = 1. - e1 + e1*c*before_first
    return before_second / before_first


def released_map(ratio):
    cosine = (3.*ratio - 1.) / (3. - ratio) if ratio <= 1. else 1.
    raw_field = np.arccos(cosine) / NOMINAL_AFI
    return max(.6, raw_field)


def evaluate():
    results = []
    for relaxation in np.geomspace(.025, 4., 28):
        for field in np.linspace(.65, 1.30, 15):
            apparent = released_map(afi_ratio(relaxation, field))
            target = spgr(HIGH, relaxation, field)
            def objective(log_params):
                m0, t1 = np.exp(log_params)
                return m0*spgr(HIGH, t1, apparent)/target - 1.
            solution = least_squares(objective, [0., np.log(relaxation)])
            assert solution.success
            m0, fitted_t1 = np.exp(solution.x)
            low_error = m0*spgr(LOW, fitted_t1, apparent)/spgr(LOW, relaxation, field) - 1.
            results.append(dict(seconds=relaxation, true_b1=field, apparent_b1=apparent,
                                fitted_t1_s=fitted_t1, max_relative_low_error=np.max(abs(low_error)),
                                max_relative_high_error=np.max(np.abs(solution.fun))))
    # Upstream clipping gives identical filtered maps even at different ratios.
    witness = [[100., 101.], [100., 105.]]
    derived = [released_map(b/a) for a,b in witness]
    assert derived == [.6,.6]
    # Distinct amplitudes can also preserve a nonclipped ratio exactly.
    assert released_map(.75) == released_map(3./4.)
    return dict(design_grid_points=len(results), grid='28 log-spaced nominal T1 .025..4s by 15 B1 .65..1.30',
                worst_low=max(results,key=lambda r:r['max_relative_low_error']),
                median_max_relative_low_error=float(np.median([r['max_relative_low_error'] for r in results])),
                greatest_absolute_b1_error=max(abs(r['apparent_b1']-r['true_b1']) for r in results),
                clipped_pairs=witness, resulting_source_map=derived,
                preconditions='Noiseless ideal perfectly spoiled steady states, nominal TR, unclipped-positive refit; engineering design grid only')


if __name__ == '__main__':
    print(json.dumps(evaluate(),indent=2,sort_keys=True))
