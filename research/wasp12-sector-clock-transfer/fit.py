"""Fit the Yee-only clocks and forecast Wong transit epochs with OrbDot 1.0.0."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
import zipfile

import numpy as np
import nestle
from scipy.special import ndtri

REFERENCE = 2456305.4555
PERIOD = 1.09142
WHEEL_SHA = "169e8459101c2596864d8b75aad3b25c325cff2beb66afe6e08904a5f6956b98"
MODULE_SHA = "4e2c6703c106dbdb1500a4aa684434f6832839df2a1187a0df14802c33d1cf8b"
YEECAT = "J/ApJ/888/L5/table5"
WONGCAT = "J/AJ/163/175/tablea1"


def table(catalog, columns):
    query = urlencode({"-source": catalog, "-out": ",".join(columns), "-out.max": "unlimited", "-out.meta": "h"})
    data = urlopen("https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?" + query, timeout=90).read().decode()
    rows = [[cell.strip() for cell in line.split("\t")] for line in data.splitlines()]
    start = rows.index(columns)
    return [r for r in rows[start + 1:] if len(r) == len(columns) and all(r) and r[0][0].isalnum()]


def author_module():
    release = json.load(urlopen("https://pypi.org/pypi/orbdot/1.0.0/json", timeout=30))
    url = next(row["url"] for row in release["urls"] if row["filename"].endswith(".whl"))
    wheel = urlopen(url, timeout=30).read()
    assert hashlib.sha256(wheel).hexdigest() == WHEEL_SHA
    with zipfile.ZipFile(io.BytesIO(wheel)) as archive:
        source = archive.read("orbdot/models/ttv_models.py")
    assert hashlib.sha256(source).hexdigest() == MODULE_SHA
    module = {}
    exec(compile(source, "orbdot/models/ttv_models.py", "exec"), module)
    return module


def fit(kind, design, output):
    module = author_module()
    rows = table(YEECAT, ["Event", "Orbit", "Ref", "BJD", "e_BJD"])
    assert [(r[0], int(r[1]), r[2]) for r in rows] == [tuple(r) for r in design["yee"]]
    epochs = np.array([int(r[1]) for r in rows])
    occ = np.array([r[0] == "occ" for r in rows])
    t = np.array([float(r[3]) - REFERENCE for r in rows]) - occ * (22.9 / 86400)
    err = np.array([float(r[4]) for r in rows])
    assert len(rows) == 158 and sum(occ) == 19 and np.all(err > 0)
    new = np.arange(2027, 5001, dtype=int)
    dims = {"constant": 2, "decay": 3, "precession": 5}
    n = dims[kind]
    def evaluate(p, e, is_occ):
        if kind == "constant":
            return module["ttv_constant"](p[0], p[1], 0, 0, e, primary=not is_occ)
        if kind == "decay":
            return module["ttv_decay"](p[0], p[1], p[2], 0, 0, e, primary=not is_occ)
        return module["ttv_precession"](*p, e, primary=not is_occ)
    def prior(x):
        u = np.clip(x, 1e-15, 1-1e-15)
        p = [0.01 * ndtri(u[0]), PERIOD + 0.0001 * ndtri(u[1])]
        if kind == "decay":
            p += [1e-7 * (u[2] - 1)]
        if kind == "precession":
            p += [0.1*u[2], 2*np.pi*u[3], 0.01*u[4]]
        return np.asarray(p)
    transit_epoch, eclipse_epoch = epochs[~occ], epochs[occ]
    target, sigma = np.r_[t[~occ], t[occ]], np.r_[err[~occ], err[occ]]
    def likelihood(p):
        pred = np.r_[evaluate(p, transit_epoch, False), evaluate(p, eclipse_epoch, True)]
        return -0.5 * np.sum(((target - pred) / sigma)**2)
    sampler = nestle.sample(likelihood, prior, n, method="multi", npoints=1000,
                            dlogz=0.01, rstate=np.random.RandomState(7919+n))
    w = np.asarray(sampler.weights)
    w = w / w.sum()
    pred = np.zeros(len(new))
    for start in range(0, len(w), 128):
        stop = min(start + 128, len(w))
        block = np.stack([(evaluate(p, new, False) - PERIOD*new)*86400
                          for p in sampler.samples[start:stop]])
        pred += w[start:stop] @ block
    result = dict(kind=kind, native_clock_sha256=MODULE_SHA, forecasts_seconds=pred.tolist(),
                  samples=len(w), neff=float(1/(w@w)), logz=float(sampler.logz),
                  ncall=int(sampler.ncall), ref_bjd=REFERENCE, period_days=PERIOD,
                  training_sha256=hashlib.sha256(json.dumps(rows,separators=(",",":")).encode()).hexdigest())
    Path(output).write_text(json.dumps(result,allow_nan=False,sort_keys=True)+"\n")


if __name__ == "__main__":
    parser=argparse.ArgumentParser();parser.add_argument("kind");parser.add_argument("design");parser.add_argument("output")
    args=parser.parse_args();fit(args.kind,json.loads(Path(args.design).read_text()),args.output)
