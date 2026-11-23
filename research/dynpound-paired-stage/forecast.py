"""Fit fixed single- and two-gauge controls on the registered training period."""
import collections
import hashlib
import json
import pathlib
import sys

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

def visits_weight(rows):
    sizes = collections.Counter(r["visit"] for r in rows)
    return np.array([1.0 / sizes[r["visit"]] for r in rows])

def design(row, scale, paired):
    h = np.asarray(row["local"])
    f = [h[-1], h[-1]**2, h[-1]**3, np.arcsinh(row["stock_cfs"]/scale),
         np.arcsinh(row["steady_cfs"]/scale), *list(h[-1]-h[:-1])]
    if paired:
        n = np.asarray(row["neighbor"])
        f.extend([n[-1], n[-1]**2, h[-1]*n[-1], *list(n[-1]-n[:-1])])
    return np.asarray(f)

def background_head(training, weights):
    h = np.asarray([r["local"] for r in training])
    d = np.asarray([r["head"] for r in training])
    lo, hi = float(h.min()), float(h.max())
    if lo == hi:
        raise ValueError("constant training stage")
    z = (2*h-lo-hi)/(hi-lo)
    design = np.stack([np.ones_like(z), z, z*z], axis=-1).reshape(-1,3)
    weight = np.repeat(np.sqrt(weights),h.shape[1])
    coeff = np.linalg.lstsq(design*weight[:,None],d.ravel()*weight,rcond=None)[0]
    return lo, hi, coeff

def pressure_correction(r, bg):
    lo, hi, coeff = bg
    h = np.asarray(r["local"])
    z = np.clip((2*h-lo-hi)/(hi-lo),-1,1)
    head = np.asarray(r["head"]) - (coeff[0]+z*(coeff[1]+z*coeff[2]))
    speed = 0.0
    tau = np.asarray(r["tau_s"])
    for step in range(1,len(head)):
        t = 0.5*(tau[step-1]+tau[step])
        forcing = r["gravity"]*(head[step-1]+head[step])/(2*r["length_ft"])
        decay = np.exp(-3600/t)
        speed = decay*speed + (-np.expm1(-3600/t))*t*forcing
    return float(r["area"][-1]*speed)

def build(regressor, param):
    if regressor == "ridge":
        return make_pipeline(StandardScaler(),Ridge(alpha=param))
    depth, count = param
    return GradientBoostingRegressor(loss="huber",n_estimators=count,max_depth=depth,
                                    learning_rate=0.04,min_samples_leaf=4,random_state=7)

def fit(model, family, xx, yy, ww):
    if family == "ridge":
        model.fit(xx,yy,standardscaler__sample_weight=ww,ridge__sample_weight=ww)
    else:
        model.fit(xx,yy,sample_weight=ww)
    return model

def train_control(name, xx, yy, weight, years):
    family = "ridge" if name.endswith("ridge") else "boost"
    grid = (0.1,1.,10.,100.) if family=="ridge" else ((1,75),(1,150),(2,75),(2,150))
    costs = []
    for param in grid:
        folds = []
        for year in sorted(set(years)):
            train = years!=year
            test = ~train
            model = fit(build(family,param),family,xx[train],yy[train],weight[train])
            folds.append(float(np.average(np.abs(model.predict(xx[test])-yy[test]),weights=weight[test])))
        costs.append(float(np.mean(folds)))
    idx = int(np.argmin(costs))
    return fit(build(family,grid[idx]),family,xx,yy,weight), {"selected":grid[idx],"cv":costs}

def main(root, features_digest):
    base = root / "exact-field-clock-course"
    blob = (base/"physical-features.json").read_bytes()
    assert hashlib.sha256(blob).hexdigest()==features_digest
    data = json.loads(blob)
    assert all("q_measured" not in r for r in data if r["period"]=="development")
    outputs, params = [], {}
    for site in sorted({r["site"] for r in data}):
        eligible = [r for r in data if r["site"]==site and "stock_cfs" in r]
        training = [r for r in eligible if r["period"]=="training"]
        assert len(training)>15
        w = visits_weight(training)
        y = np.array([r["q_measured"] for r in training],dtype=float)
        scale = float(np.median(np.abs(y)))
        assert scale>0
        yy = np.arcsinh(y/scale)
        years = np.asarray([r["time"][:4] for r in training])
        bg = background_head(training,w)
        xstock = np.arcsinh(np.asarray([r["stock_cfs"] for r in training])/scale)
        dm = np.column_stack([np.ones(len(y)),xstock])
        cal = np.linalg.lstsq(dm*np.sqrt(w[:,None]),yy*np.sqrt(w),rcond=None)[0]
        baseq = scale*np.sinh(dm@cal)
        physical = np.asarray([pressure_correction(r,bg) for r in training])
        gains = np.linspace(0,4,129)
        loss = [float(np.average(np.abs(np.arcsinh((baseq+g*physical)/scale)-yy),weights=w)) for g in gains]
        gain = float(gains[int(np.argmin(loss))])
        iso = IsotonicRegression(out_of_bounds="clip").fit([r["local"][-1] for r in training],yy,sample_weight=w)
        models = {}
        settings = {}
        for name in ("local_ridge","paired_ridge","paired_boost"):
            xx = np.asarray([design(r,scale,name!="local_ridge") for r in training])
            models[name], settings[name] = train_control(name,xx,yy,w,years)
        params[site] = {"stage_background_domain":bg[:2],"background_coefficients":bg[2].tolist(),
                        "stock_affine":cal.tolist(),"gain":gain,"gain_training_curve":loss,
                        "controls":settings,"scale":scale}
        for r in eligible:
            h = r["local"][-1]
            q = r["stock_cfs"]
            stockcal = float(scale*np.sinh(cal[0]+cal[1]*np.arcsinh(q/scale)))
            raw = pressure_correction(r,bg)
            predictions = {"stock_core":q,"stock_calibrated":stockcal,"steady":r["steady_cfs"],
                           "static_isotonic":float(scale*np.sinh(iso.predict([h])[0])),
                           "momentum":stockcal+gain*raw,"wrong_sign":stockcal-gain*raw}
            for name, model in models.items():
                xx = design(r,scale,name!="local_ridge").reshape(1,-1)
                predictions[name] = float(scale*np.sinh(model.predict(xx)[0]))
            record = {k:r[k] for k in ("site","period","visit","time","grid_end")}
            assert all(np.isfinite(list(predictions.values())))
            record.update(forecasts=predictions,raw_pressure_cfs=raw,scale=scale)
            if r["period"]=="training":
                record["q_measured"]=r["q_measured"]
            outputs.append(record)
        print("fitted",site,"training rows",len(training),"Q scale",scale,"gain",gain,"selected",settings,flush=True)
    refused = [{k:r[k] for k in ("site","period","visit","time","refusal")} for r in data if "refusal" in r]
    result = {"source_features_sha256":features_digest,"parameters":params,"rows":outputs,"refused":refused}
    b = json.dumps(result,sort_keys=True,ensure_ascii=False,separators=(",",":"),allow_nan=False).encode()
    fp = base/"locked-forecasts.json"
    fp.write_bytes(b)
    reread=fp.read_bytes(); assert reread==b
    print("LOCKED_FORECAST",len(b),hashlib.sha256(reread).hexdigest(),"rows",len(outputs),"refused",len(refused),flush=True)
if __name__=="__main__":
    main(pathlib.Path(sys.argv[1]),sys.argv[2])
