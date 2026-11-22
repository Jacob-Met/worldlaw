"""Read DLR global DIC node maps and their native triangular topology."""

import numpy as np
import warnings


def path_name(s, table):
    end = ".txt" if table == "Nodemaps" else "_connections.txt"
    return f"global_3d_dic/{table}/global_3d_dic_results_1_{s}{end}"


def read(z, stage):
    with z.open(path_name(stage, "Nodemaps")) as f:
        x = np.loadtxt(f, comments="#", delimiter=";", usecols=(0, 1, 2, 3, 4, 5, 6))
    ids = x[:, 0].astype(np.int64)
    assert (x[:, 0] == ids).all() and len(np.unique(ids)) == len(ids)
    with z.open(path_name(stage, "Connections")) as f:
        f.readline()
        tri = np.loadtxt(f, delimiter=";", dtype=np.int64, usecols=(1, 2, 3, 4))
    assert len(np.unique(tri[:, 0])) == len(tri)
    tri = tri[tri[:, 1] != -1, 1:]
    assert (tri >= 0).all() and np.isin(tri + 1, ids).all()
    tri += 1
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e.sort(axis=1)
    e = np.unique(e, axis=0)
    assert np.all(e[:, 0] < e[:, 1])
    return ids, x[:, 1:4], x[:, 4:7], e


def align(points, target, mask):
    x = points[mask]
    y = target[mask]
    u, _, vh = np.linalg.svd((x - x.mean(0)).T @ (y - y.mean(0)))
    flip = np.eye(3)
    flip[2, 2] = np.sign(np.linalg.det(u @ vh))
    rotation = u @ flip @ vh
    assert (
        np.allclose(rotation.T @ rotation, np.eye(3), rtol=0, atol=1.0e-11)
        and np.linalg.det(rotation) > 0
    )
    return (points - x.mean(0)) @ rotation + y.mean(0)


def edge_code(e):
    return (e[:, 0] << 32) | e[:, 1]


def neighbourhood_state(xyz, disp, edges, ids):
    """Original-stage adjacency defines component-wise median. A vertex needs three finite neighbours."""
    order = np.argsort(ids)
    n = ids[order]
    x = xyz[order]
    u = disp[order]
    ia = np.searchsorted(n, edges)
    src = np.r_[ia[:, 0], ia[:, 1]]
    dst = np.r_[ia[:, 1], ia[:, 0]]
    sort = np.argsort(src, kind="stable")
    src = src[sort]
    dst = dst[sort]
    degrees = np.bincount(src, minlength=len(n))
    counts_before = np.cumsum(degrees) - degrees
    slot = np.arange(len(src)) - counts_before[src]
    indices = np.full((len(n), int(degrees.max())), len(n), dtype=np.int32)
    indices[src, slot] = dst
    valid = np.isfinite(x).all(axis=1) & np.isfinite(u).all(axis=1)
    observed = np.where(valid[:, None], u, np.nan)
    neighbors = np.vstack([observed, np.full((1, 3), np.nan)])[indices]
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message="All-NaN slice encountered")
        med = np.nanmedian(neighbors, axis=1)
    available = np.isfinite(neighbors).all(axis=2).sum(axis=1) >= 3
    flag = valid & available & (np.linalg.norm(observed - med, axis=1) > 0.15)
    clean = observed.copy()
    clean[flag] = med[flag]
    return n, x, observed, clean, flag


def material_stage(z, stage, mat):
    ids = mat["ids"]
    ref = mat["ref"]
    edges = mat["edges"]
    base = edge_code(edges)
    n, x, u, e = read(z, stage)
    n, x, u, clean, flag = neighbourhood_state(x, u, e, n)
    shared, rr, jj = np.intersect1d(ids, n, assume_unique=True, return_indices=True)
    diff = np.linalg.norm(x[jj] - ref[rr], axis=1)
    keep = np.isfinite(diff) & (diff <= 1e-5) & np.isfinite(u[jj]).all(axis=1)
    p = np.full_like(ref, np.nan)
    p[rr[keep]] = x[jj[keep]] + u[jj[keep]]
    cp = np.full_like(ref, np.nan)
    cp[rr[keep]] = x[jj[keep]] + clean[jj[keep]]
    fl = np.zeros(len(ids), dtype=bool)
    fl[rr[keep]] = flag[jj[keep]]
    return p, cp, fl, np.isin(base, edge_code(e), assume_unique=True)


def length(points, ij):
    return np.linalg.norm(points[ij[:, 1]] - points[ij[:, 0]], axis=1)


def endpoint_features(z, g, mat, ij):
    ref = mat["ref"]
    base_length = mat["lengths"]
    sides = [material_stage(z, g[k][0], mat) for k in ("low", "high")]
    low, high = sides
    lo, lc, lf, le = low
    hi, hc, hf, he = high
    valid = np.isfinite(lo).all(axis=1) & np.isfinite(hi).all(axis=1)
    r = (g["mid"][1] - g["low"][1]) / (g["high"][1] - g["low"][1])

    def interpolate(x, y):
        return length((1 - r) * align(x, ref, valid) + r * align(y, ref, valid), ij) - base_length

    vec = interpolate(lo, hi)
    clean = interpolate(lc, hc)
    loe = length(lo, ij) - base_length
    hie = length(hi, ij) - base_length
    common = le & he & valid[ij[:, 0]] & valid[ij[:, 1]]
    key = lf[ij[:, 0]].astype("u1") + 2 * lf[ij[:, 1]] + 4 * hf[ij[:, 0]] + 8 * hf[ij[:, 1]]
    return {
        "ratio": r,
        "low": loe,
        "high": hie,
        "vector": vec,
        "scalar": (1 - r) * loe + r * hie,
        "clean": clean,
        "key": key,
        "common": common,
        "node_flags": lf | hf,
    }


def middle_response(z, g, mat, ij):
    p, c, flag, present = material_stage(z, g["mid"][0], mat)
    return length(p, ij) - mat["lengths"], length(c, ij) - mat["lengths"], present, flag
