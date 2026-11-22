"""Frozen historical interpolation and conditional observed-vertex comparator."""

import hashlib
import numpy as np
from scipy.ndimage import gaussian_filter


class History:
    def __init__(self, material, spatial_bin_mm=2.0):
        center = material["centers"][:, :2]
        directions = material["orient"][:, :2]
        bins = np.floor((center - center.min(axis=0)) / spatial_bin_mm).astype(int)
        angle = np.arctan2(directions[:, 1], directions[:, 0]) % np.pi
        self.which = np.column_stack((bins, (np.floor(8 * (angle / np.pi) + 0.5).astype(int) % 8)))
        self.grid_shape = tuple(self.which.max(axis=0) + 1)
        self.grid_index = np.ravel_multi_index(self.which.T, self.grid_shape)
        self.len = material["lengths"]
        self.acc = np.zeros_like(self.len)
        self.n = np.zeros(self.len.shape, dtype=np.int64)
        self.spacing = spatial_bin_mm
        self.groups = 0
        self.sum_global = 0.0
        self.sum_load = 0.0

    def update(self, obs):
        truth = obs["y"]
        v = obs["vector"]
        lo = obs["low"]
        hi = obs["high"]
        r = float(obs["ratio"])
        finite = np.isfinite(truth) & np.isfinite(v) & np.isfinite(lo) & np.isfinite(hi)
        strain = (truth[finite] - v[finite]) / (r * (1 - r) * self.len[finite])
        self.acc[finite] += strain
        self.n[finite] += 1
        self.sum_global += np.mean(strain)
        amp = hi[finite] - lo[finite]
        # A scalar effective interpolation-fraction offset calibrated per previous load group.
        self.sum_load += np.dot(amp, truth[finite] - v[finite]) / max(np.dot(amp, amp), 1.0e-20)
        self.groups += 1

    def predictions(self, obs):
        r = float(obs["ratio"])
        factor = r * (1 - r)
        v = obs["vector"]
        if self.groups < 1:
            raise ValueError("Need at least one original calibration group")
        local = np.divide(self.acc, self.n, out=np.zeros_like(self.acc), where=self.n > 0)
        means = np.bincount(
            self.grid_index, weights=self.acc, minlength=int(np.prod(self.grid_shape))
        ).reshape(self.grid_shape)
        count = np.bincount(
            self.grid_index, weights=self.n, minlength=int(np.prod(self.grid_shape))
        ).reshape(self.grid_shape)
        # Fixed2-mm Gaussian spatial SD and half an angular bin in axial orientation.
        smooth = lambda a: gaussian_filter(
            a, sigma=(1.0, 1.0, 0.5), mode=("constant", "constant", "wrap")
        )
        denom = smooth(count)
        grid = np.divide(smooth(means), denom, out=np.zeros_like(means), where=denom > 0.0)
        prior = grid.ravel()[self.grid_index]
        return {
            "length_secant": obs["scalar"],
            "vector_secant": v,
            "past_global_strain": v + factor * self.len * self.sum_global / self.groups,
            "past_effective_load": v + (obs["high"] - obs["low"]) * self.sum_load / self.groups,
            "past_same_edge": v + factor * self.len * local,
            "past_spatial_orientation": v + factor * self.len * prior,
        }


class Readout:
    def __init__(self, material):
        self.raw = History(material)
        self.cleaned = History(material)
        n = len(material["edges"])
        self.add = np.zeros((n, 16))
        self.n = np.zeros((n, 16), dtype=np.int64)
        self.j = np.arange(n)

    def learn(self, ex, y, yc, mask):
        valid = (
            mask
            & np.isfinite(y)
            & np.isfinite(yc)
            & np.isfinite(ex["clean"])
            & np.isfinite(ex["vector"])
        )
        clean_obs = dict(ex, y=np.where(valid, yc, np.nan), vector=ex["clean"])
        self.cleaned.update(clean_obs)
        self.raw.update(dict(ex, y=np.where(valid, y, np.nan)))
        k = (self.j[valid], ex["key"][valid])
        self.add[k] += (y - yc)[valid]
        self.n[k] += 1

    def predict(self, ex):
        out = self.raw.predictions(ex)
        prior = self.cleaned.predictions(dict(ex, vector=ex["clean"]))
        support = self.n.sum(axis=1)
        unconditional = np.divide(
            self.add.sum(axis=1), support, out=np.zeros(len(self.j)), where=support > 0
        )
        k = (self.j, ex["key"])
        correction = (self.add[k] + 4 * unconditional) / (self.n[k] + 4)
        out["clean_vector"] = ex["clean"]
        out["sparse_unconditional"] = prior["past_spatial_orientation"] + unconditional
        out["sparse_endpoint_conditional"] = prior["past_spatial_orientation"] + correction
        return out


def forecast_digest(values):
    t = hashlib.sha256()
    for k in sorted(values):
        t.update(k.encode())
        t.update(np.asarray(values[k], dtype="<f8").tobytes())
    return t.hexdigest()


def metrics(pred, y, mask, edges, previously_flagged):
    ok = mask & np.isfinite(y)
    for p in pred.values():
        if not np.isfinite(p[ok]).all():
            raise ValueError("forecast availability differs across arms")
    hot = (edges == 9980).any(axis=1)
    known = np.isin(edges, previously_flagged).any(axis=1)
    slices = {
        "incident_9980": hot,
        "other_training_flagged": known & ~hot,
        "ordinary": ~(hot | known),
    }
    return {
        "n": int(ok.sum()),
        "n9980": int((ok & hot).sum()),
        "rmse_um": {
            k: float(1e3 * np.sqrt(np.mean((v[ok] - y[ok]) ** 2))) for k, v in pred.items()
        },
        "slice_edges": {s: int((ok & a).sum()) for s, a in slices.items()},
        "slice_sum_squared_um2": {
            s: {k: float(1e6 * np.sum((v[ok & a] - y[ok & a]) ** 2)) for k, v in pred.items()}
            for s, a in slices.items()
        },
    }
