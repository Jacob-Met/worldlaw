"""Finite-screen versus confined Theis transient on the released TestUM pumping test."""
import argparse
import hashlib
import io
import json
import math
import zipfile
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy.integrate import cumulative_trapezoid
from scipy.special import exp1

SHA = "ab7d202b630667c53f868c4fa20c43c8847af46f180ce6757beb2839b1a1d034"
WELLS = ("W2_2z_D09", "W2_2z_U01", "W2_2z_U07")
DEPTHS = np.array([7.5, 10.5, 13.5])
GRID_D = np.geomspace(.01, 10000., 41)
GRID_A = np.geomspace(.003, 1, 23)
RATE = 5.82 / 60000  # cubic metres per second


def read_release(path):
    assert hashlib.sha256(path.read_bytes()).hexdigest() == SHA
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        coord_name = next(n for n in names if n.endswith("/CoordinateData.txt"))
        xy = {}
        for row in archive.read(coord_name).decode().splitlines()[1:]:
            fields = row.split()
            if fields:
                xy[fields[0]] = list(map(float, fields[1:3]))
        observed = np.zeros((3, 3, 933))
        for i, well in enumerate(WELLS):
            for j in range(3):
                name = next(n for n in names if f"{well}_S1_R{j + 1}_" in n)
                t, observed[i, j] = np.loadtxt(io.BytesIO(archive.read(name))).T
                assert np.array_equal(t, np.arange(933))
        name = next(n for n in names if "/NMR4_NMR4_S1_" in n)
        pump = np.loadtxt(io.BytesIO(archive.read(name)))
        assert np.array_equal(pump[:, 0], np.arange(0, 933, 2))
    distances = np.array([math.dist(xy[w], xy["NMR04"]) for w in WELLS])
    return observed, pump, distances


def pulse(step, cutoff):
    response = step.copy()
    response[..., cutoff:] -= step[..., :-cutoff]
    return response


def theis(distances, D, cutoff):
    t = np.arange(1, 933)
    unit = np.zeros((3, 1, 933))
    unit[:, 0, 1:] = exp1(distances[:, None] ** 2 / (4 * D * t))
    return np.repeat(pulse(unit, cutoff), 3, axis=1)


def screen_mean_cos(depth, n):
    # Below the top of the confined aquifer at 6 m. All published screens are 1 m long.
    k = np.pi * n / 9
    return np.cos((np.asarray(depth)[..., None] - 6) * k) * np.sinc(k / (2*np.pi))


def confined_layers(distances, D, alpha, cutoff, modes=64, n_time=420):
    # Normalized by Q/(4 pi T). Log-time integration of the vertical Neumann
    # heat kernel; its n=0 part has the analytic Theis step response.
    times = np.geomspace(1e-7, 932, n_time)
    ltimes = np.log(times)
    n = np.arange(1, modes + 1)
    weights = 2 * screen_mean_cos(9.5, n) * screen_mean_cos(DEPTHS, n)
    decay = np.exp(-np.outer((np.pi*n/9)**2, D*alpha*times))
    depth_terms = weights @ decay
    radial = np.exp(-distances[:, None]**2 / (4*D*times))
    product = radial[:, None, :] * depth_terms[None, :, :]
    step_modes = cumulative_trapezoid(product, x=ltimes, axis=-1, initial=0)
    step = np.zeros((3, 3, 933))
    log_sample = np.log(np.arange(1, 933))
    for i in range(3):
        for j in range(3):
            step[i, j, 1:] = np.interp(log_sample, ltimes, step_modes[i, j])
    return theis(distances, D, cutoff) + pulse(step, cutoff)


def fit_all(obs, distances, cutoff, dgrid, agrid):
    results = {}
    for method in ("Theis", "finite_screen"):
        winners = [[math.inf] for _ in WELLS]
        for D in dgrid:
            for alpha in ([None] if method == "Theis" else agrid):
                y = (theis(distances, D, cutoff) if alpha is None else
                     confined_layers(distances, D, alpha, cutoff))
                uy = (y*obs).sum(axis=(1, 2))
                uu = (y*y).sum(axis=(1, 2))
                for i in range(3):
                    train = [j for j in range(3) if j != i]
                    gain = max(0, sum(uy[train]) / sum(uu[train]))
                    mse = np.mean((obs[train] - gain*y[train])**2)
                    if mse < winners[i][0]:
                        winners[i] = [float(mse), float(D), None if alpha is None else float(alpha), float(gain)]
        results[method] = winners
    return results


def summarize(obs, pump, rad, fits, cutoff):
    rows = {}
    pred = {}
    for name, winners in fits.items():
        pred[name] = np.zeros_like(obs)
        rows[name] = []
        for i, (train_loss, D, a, g) in enumerate(winners):
            arr = (theis(rad, D, cutoff) if a is None else confined_layers(rad, D, a, cutoff))
            y = g * arr[i]
            pred[name][i] = y
            high = y if a is None else g*confined_layers(rad,D,a,cutoff,128,1100)[i]
            error = y-obs[i]
            d, t = np.unravel_index(np.argmax(abs(error)), error.shape)
            def rmse(x): return float(1000*np.sqrt(np.mean(x**2)))
            rows[name].append(dict(well=WELLS[i], train_rmse_mm=1000*math.sqrt(train_loss),
                D_m2_s=D, vertical_horizontal_ratio=a, T_m2_s=RATE/(4*np.pi*g) if g>0 else None,
                gain_m=g, full_rmse_mm=rmse(error), pumping_rmse_mm=rmse(error[:,:cutoff+1]),
                recovery_rmse_mm=rmse(error[:,cutoff+1:]), max_refinement_mm=1000*float(np.max(abs(y-high))),
                worst=dict(seconds=int(t),depth_m=float(DEPTHS[d]),measured_m=float(obs[i,d,t]),
                           calculated_m=float(y[d,t]),error_mm=float(error[d,t]*1000))))
    rr=np.array([x["full_rmse_mm"] for x in rows['finite_screen']])/np.array([x["full_rmse_mm"] for x in rows['Theis']])
    overall=np.mean([x["full_rmse_mm"] for x in rows['finite_screen']])/np.mean([x["full_rmse_mm"] for x in rows['Theis']])
    floor=[]
    for i in range(3):
        span=np.ptp(obs[i],axis=0)
        j=int(np.argmax(span));floor.append(dict(well=WELLS[i],at_s=j,depth_values_m=obs[i,:,j].tolist(),
            minimum_any_depthblind_worst_mm=500*float(span[j]),
            minimum_any_depthblind_rmse_mm=1000*float(np.sqrt(np.mean((obs[i]-np.mean(obs[i],axis=0))**2)))))
    return dict(fits=rows, ratios=rr.tolist(),mean_ratio=float(overall),decision=bool(overall<=.9 and np.all(rr<=1.05)),
                depthblind_exact_oracle=floor,pumping_source_minimum=pump[np.argmin(pump[:,1])].tolist()),pred


def control():
    # Positive, reciprocal two-channel head circuit. External conductance =3 in
    # both networks for every imposed head history. Actual internal flow splits differ.
    g1,g2=Fraction(1),Fraction(2)
    delta=Fraction(7,13)
    assert (g1+g2)*delta==(g2+g1)*delta
    q=Fraction(1)
    assert [q*x/(g1+g2) for x in (g1,g2)]==[Fraction(1,3),Fraction(2,3)]
    return {"conductances":["1,2","2,1"],"same_total_at_any_drop":"3 delta_h",
            "upper_branch_fractions":["1/3","2/3"],
            "scope":"parallel hydraulic channels with common end heads; external finite network and every external head unchanged under exchanging conductances; no site-specific fit or claim of equality for resolved spatial PDEs"}


def main():
    p=argparse.ArgumentParser();p.add_argument('archive',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
    obs,pump,rad=read_release(args.archive);args.output.mkdir(parents=True,exist_ok=True)
    fits=fit_all(obs,rad,332,GRID_D,GRID_A)
    outcome,forecasts=summarize(obs,pump,rad,fits,332)
    # Independently retain the one-second activity-clock ambiguity. Fits do not
    # select between the two clocks using evaluation error.
    contrast,_=summarize(obs,pump,rad,fit_all(obs,rad,333,GRID_D,GRID_A),333)
    frozen={'archive_sha256':SHA,'fold_unit':'entire observation well, same pumping event',
            'count':int(obs.size),'distances_m':rad.tolist(),'D_grid':GRID_D.tolist(),
            'a_grid':GRID_A.tolist(),'primary':outcome,'333s_activity_log':contrast,'hydraulic_control':control()}
    path=args.output/'pressure-receiver.json';path.write_text(json.dumps(frozen,indent=2)+'\n')
    np.savez_compressed(args.output/'pressure-predictions.npz',observed_m=obs,source_pump_m=pump,**forecasts)
    print('PRIMARY',json.dumps(outcome),flush=True)
    print('COMPLETE',hashlib.sha256(path.read_bytes()).hexdigest(),path,flush=True)
if __name__=='__main__':
    main()
