"""Bounded exhaustive sparse fits of weak equations assembled from measured states."""
from itertools import combinations
from functools import lru_cache
import math

import numpy as np
import torch


DT = .025
N = 128
GRID = 16
DX = 2 * np.pi / GRID


def menu(layout):
    if layout == "periodic":
        trees = [("one",)]
        for power in range(1, 4):
            for order in range(5):
                trees.append(("spatial", order, power))
        return trees
    trees = [("power", a, degree-a) for degree in range(4) for a in range(degree+1)]
    trees.extend((op, channel) for op in ("sin", "cos", "abs", "tanh") for channel in range(2))
    trees.extend([("signed_square", 0), ("signed_square", 1)])
    return trees


def feature(y, tree):
    if tree[0] == "one":
        return np.ones_like(y)
    if tree[0] == "spatial":
        _, order, power = tree
        f = y**power
        if not order:
            return f
        r, l = np.roll(f, -1, axis=-1), np.roll(f, 1, axis=-1)
        if order == 1:
            return (r-l)/(2*DX)
        if order == 2:
            return (r-2*f+l)/DX**2
        rr, ll = np.roll(f, -2, axis=-1), np.roll(f, 2, axis=-1)
        if order == 3:
            return (rr-2*r+2*l-ll)/(2*DX**3)
        return (rr-4*r+6*f-4*l+ll)/DX**4
    if tree[0] == "power":
        return (y[..., 0]**tree[1] * y[..., 1]**tree[2])[..., None]
    v = y[..., tree[1]:tree[1]+1]
    if tree[0] == "signed_square":
        return np.abs(v)*v
    return getattr(np, tree[0])(v)


def syntax(tree, layout):
    def power(atom, degree):
        if degree == 0:
            return "one"
        if degree == 1:
            return atom
        return ["mul", atom, power(atom, degree-1)]
    if tree[0] == "one":
        return "one"
    if layout == "periodic":
        _, order, degree = tree
        atom = power("field", degree)
        operator = [None, "gradient", "laplacian", "thirdDerivative", "biharmonic"][order]
        return [operator, atom] if order else atom
    if tree[0] == "power":
        _, a, b = tree
        if not a or not b:
            return power("position", a) if a else power("rate", b)
        return ["mul", power("position", a), power("rate", b)]
    atom = ["position", "rate"][tree[1]]
    return ["mul", ["abs", atom], atom] if tree[0] == "signed_square" else [tree[0], atom]


def command(layout, drive, times):
    times = np.asarray(times)
    n = GRID if layout == "periodic" else 2
    if drive < 0:
        return np.zeros((*times.shape, n))
    value = .48 * (1 if drive < 4 else -1) * np.sin(2*np.pi*(1+drive%4)*times/(DT*N))
    direction = np.sqrt(2)*np.sin((1+drive%3)*np.arange(GRID)*DX+.3) if layout == "periodic" else np.array(
        [0., 1.] if layout == "oscillator" else [1., 0.])
    return value[..., None]*direction


def observation(clean, db, seed, drive):
    gen = np.random.default_rng(seed)
    scale = clean.std(axis=0)*10**(-db/20)
    if not np.all(scale > 0):
        raise ValueError("constant observed channel")
    e = gen.standard_normal(clean.shape)
    e = (e-e.mean(axis=0))/e.std(axis=0)
    return clean+e*scale, drive, scale


def permute(run, seed):
    y, d, scale = run
    order = np.random.default_rng(seed).permutation(len(y)-2)+1
    return np.concatenate([y[:1], y[order], y[-1:]]), d, scale


def design(run, layout, method):
    y, drive, _ = run
    f = np.stack([feature(y, tree) for tree in menu(layout)], axis=-1)
    u = command(layout, drive, np.arange(len(y))*DT)
    if method == "sindy":
        mids = np.arange(3, len(y)-3, 3)
        target = sum(i*y[mids+i] for i in range(-3, 4))/(28*DT)-u[mids]
        return f[mids], target
    width = 24
    mids = np.arange(0, len(y)-width, 8)
    test = 1-np.abs((2*np.arange(width)+1)/width-1)
    area = test.sum()*DT
    state_w = np.diff(np.r_[0., -test, 0.])/area
    field_w = DT*(np.r_[0., test]+np.r_[test, 0.])/(2*area)
    idx = mids[:, None]+np.arange(width+1)[None, :]
    return (np.einsum("w,twnp->tnp", field_w, f[idx]),
            np.einsum("w,twn->tn", state_w, y[idx])-np.einsum("w,twn->tn", field_w, u[idx]))


@lru_cache(None)
def supports(count, terms):
    return torch.tensor(list(combinations(range(count), terms)), dtype=torch.long, device="cuda")


def sparse_candidates(X, Y):
    # One independent constant coefficient vector per observed response component.
    x = torch.as_tensor(np.ascontiguousarray(X), dtype=torch.float64, device="cuda")
    y = torch.as_tensor(np.ascontiguousarray(Y), dtype=torch.float64, device="cuda")
    n, p = x.shape
    scale = torch.linalg.vector_norm(x, dim=0).clamp_min(1e-12)
    a = x/scale
    gram, rhs, energy = a.T@a, a.T@y, y@y
    ranked = []
    for k in (1, 2, 3):
        ids = supports(p, k)
        g = gram[ids[:, :, None], ids[:, None, :]]
        h = rhs[ids]
        beta, info = torch.linalg.solve_ex(g+torch.eye(k, dtype=g.dtype, device=g.device)*1e-8, h[..., None])
        beta = beta.squeeze(-1)
        residual = energy-2*(beta*h).sum(1)+torch.einsum("bi,bij,bj->b", beta, g, beta)
        bic = torch.log((residual/n).clamp_min(1e-24))+k*math.log(n)/n
        bic = torch.where((info == 0) & torch.isfinite(bic), bic, float("inf"))
        vals, ix = torch.topk(bic, 3, largest=False)
        weights = beta[ix]/scale[ids[ix]]
        for score, active, coef in zip(vals.tolist(), ids[ix].tolist(), weights.tolist()):
            ranked.append((score, list(zip(active, coef))))
    return [terms for score, terms in sorted(ranked, key=lambda r: r[0])[:3]]


def estimate(runs, layout, method):
    parts = [design(r, layout, method) for r in runs]
    x, y = [np.concatenate(z, axis=0) for z in zip(*parts)]
    bank = menu(layout)
    if layout == "periodic":
        channels = [sparse_candidates(x.reshape(-1, len(bank)), y.reshape(-1))]
    else:
        channels = [sparse_candidates(x[:, 0], y[:, j]) for j in range(2)]
    return [[[ (bank[i], c) for i, c in channel[rank] ] for channel in channels] for rank in range(3)]


def predict(layout, models, ic, drive, steps=N):
    y = np.asarray(ic, dtype=np.float64).copy()
    path = [y]
    def rhs(z, u):
        if not np.isfinite(z).all() or np.max(abs(z)) > 80:
            raise FloatingPointError
        channels = [sum(c*feature(z, tree) for tree, c in terms) for terms in models]
        return (channels[0] if layout == "periodic" else np.concatenate(channels, axis=-1))+u
    inputs = command(layout, drive, np.arange(2*steps+1)*DT/2)
    try:
        with np.errstate(over="raise", invalid="raise", divide="raise"):
            for t in range(steps):
                a = rhs(y, inputs[2*t])
                b = rhs(y+DT*a/2, inputs[2*t+1])
                c = rhs(y+DT*b/2, inputs[2*t+1])
                d = rhs(y+DT*c, inputs[2*t+2])
                y = y+DT*(a+2*b+2*c+d)/6
                if not np.isfinite(y).all() or np.max(abs(y))>80:
                    return None
                path.append(y)
    except FloatingPointError:
        return None
    return np.asarray(path)


def design_drive(pilot, layout):
    committee = estimate([pilot], layout, "weak")
    y, _, scale = pilot
    scores = []
    for drive in range(8):
        paths = [predict(layout, model, y[0], drive, 32) for model in committee]
        scores.append(0. if any(z is None for z in paths) else min(
            np.mean(((a[4::4]-b[4::4])/scale)**2) for a, b in combinations(paths, 2)))
    return int(np.argmax(scores)), list(map(float, scores))


def forecast_error(model, run, layout):
    y, drive, scale = run
    path = predict(layout, model, y[0], drive)
    return None if path is None else float(np.sqrt(np.mean(((path[1:]-y[1:])/scale)**2)))
