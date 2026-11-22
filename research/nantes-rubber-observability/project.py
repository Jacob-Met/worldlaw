"""Evaluate kinematic support and two discrete virtual-work sensitivities without reading F."""

import hashlib

import h5py
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import spsolve

from witness import planar_principal_stress


def ids(array, n):
    a = np.asarray(array).ravel()
    if (
        not np.all(np.isfinite(a))
        or not np.all(a == np.floor(a))
        or np.min(a) < 1
        or np.max(a) > n
    ):
        raise ValueError("invalid source mesh index")
    return a.astype(int) - 1


def virtual_fields(x, tri, sets, measured):
    n = len(x)
    ref = x[tri]
    D = np.swapaxes(ref[:, 1:] - ref[:, :1], 1, 2)
    inv = np.linalg.inv(D)
    area = 0.5 * np.abs(np.linalg.det(D))
    natural = np.array([[-1.0, -1.0], [1.0, 0.0], [0.0, 1.0]])
    grad = natural @ inv
    edges = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [0, 2]]])
    e, c = np.unique(np.sort(edges, axis=1), axis=0, return_counts=True)
    assert c.max() == 2
    boundary = np.unique(e[c == 1])
    force = np.unique(measured)
    matched = [k for k, s in sets.items() if np.array_equal(np.unique(s), force)]
    assert np.isin(force, boundary).all(), (
        "non-boundary force set",
        len(force),
        len(boundary),
    )
    constant = np.zeros(n)
    constant[force] = 1
    inner = np.setdiff1d(np.arange(n), boundary)
    local = area[:, None, None] * (grad @ np.swapaxes(grad, 1, 2))
    K = coo_matrix(
        (
            local.ravel(),
            (
                np.broadcast_to(tri[:, :, None], local.shape).ravel(),
                np.broadcast_to(tri[:, None, :], local.shape).ravel(),
            ),
        ),
        shape=(n, n),
    ).tocsr()
    harmonic = constant.copy()
    harmonic[inner] = spsolve(K[inner, :][:, inner], -(K[inner, :] @ constant))
    return (
        inv,
        area,
        [(z[tri][:, None, :] @ grad)[:, 0, :] for z in (constant, harmonic)],
        matched,
        boundary,
    )


def val(h, d, name, frame):
    if name not in {"X", "U", "H", "Connectivity", "Force_sets", "Dirichlet"}:
        raise KeyError(name)
    return h[d[name][frame, 0]]


def file_run(path, md5):
    with path.open("rb") as f:
        assert hashlib.file_digest(f, "md5").hexdigest() == md5
    with h5py.File(path) as h:
        d = h["data"]
        roots = {
            k: list(v)
            if isinstance(v, h5py.Group) and not k.startswith("#")
            else list(v.shape)
            if isinstance(v, h5py.Dataset)
            else "internal object references"
            for k, v in h.items()
        }
        print("ROOTS", path.name, roots, flush=True)
        total = d["U"].shape[0]
        assert all(d[k].shape == (total, 1) for k in d)
        first = lambda k: val(h, d, k, 0)
        x = first("X")[...].T
        tri = ids(first("Connectivity")[...], len(x)).reshape(3, -1).T
        dirs = {k: ids(v[...], len(x)) for k, v in first("Dirichlet").items()}
        fs = first("Force_sets")
        assert fs.size > 2 and 1 in fs.shape
        force = ids(fs[...], len(x))
        inv, area, grads, matched, boundary = virtual_fields(x, tri, dirs, force)
        print(
            "BASIS",
            path.name,
            total,
            len(tri),
            len(x),
            len(force),
            matched,
            len(boundary),
            flush=True,
        )
        byframe = []
        active_elements = 0
        min_distance = np.inf
        max_h_err = 0.0
        max_h_abs = 0.0
        min_j = np.inf
        static_ref_fail = 0
        fixed_hash = {
            k: hashlib.sha256(first(k)[...].tobytes()).digest()
            for k in ("X", "Connectivity", "Force_sets")
        }
        for i in range(total):
            for k, s in fixed_hash.items():
                if hashlib.sha256(val(h, d, k, i)[...].tobytes()).digest() != s:
                    static_ref_fail += 1
            u = val(h, d, "U", i)[...].T
            xy = (x + u)[tri]
            F = np.swapaxes(xy[:, 1:] - xy[:, :1], 1, 2) @ inv
            j = np.linalg.det(F)
            if not np.isfinite(j).all() or np.any(j <= 0):
                bad = np.flatnonzero((~np.isfinite(j)) | (j <= 0))
                byframe.append(
                    {
                        "i": i,
                        "ineligible_jacobians": len(bad),
                        "first_element": int(bad[0]),
                    }
                )
                continue
            p, q, g = planar_principal_stress(F)
            min_j = min(min_j, float(j.min()))
            sv = np.linalg.svd(F, compute_uv=False)
            sorted3 = np.sort(np.c_[sv, 1 / j])[:, ::-1]
            dist = np.linalg.norm(sorted3 - np.array([2.0, 1.0, 0.5]), axis=1)
            active_elements += int((g > 0).sum())
            min_distance = min(min_distance, float(dist.min()))
            H = val(h, d, "H", i)[...].T
            assert H.shape == (len(tri), 3)
            eig = np.stack(
                [
                    0.5 * (H[:, 0] + H[:, 1])
                    + np.hypot(0.5 * (H[:, 0] - H[:, 1]), H[:, 2]),
                    0.5 * (H[:, 0] + H[:, 1])
                    - np.hypot(0.5 * (H[:, 0] - H[:, 1]), H[:, 2]),
                ],
                axis=1,
            )
            max_h_err = max(max_h_err, float(abs(eig - np.log(sv)).max()))
            max_h_abs = max(max_h_abs, float(abs(eig).max()))
            pred = []
            for grad in grads:
                p0 = np.einsum("e,eij,ej->i", area, p, grad)
                dq = np.einsum("e,eij,ej->i", area, q - p, grad)
                pred.append({"base": p0.tolist(), "change": dq.tolist()})
            byframe.append(
                {
                    "i": i,
                    "min_distance": float(dist.min()),
                    "active_area_fraction": float(area[g > 0].sum() / area.sum()),
                    "active": int((g > 0).sum()),
                    "projections": pred,
                }
            )
        print(
            "SCREEN",
            path.name,
            active_elements,
            "/",
            total * len(tri),
            "min_distance",
            min_distance,
            "minJ",
            min_j,
            "max_H_eigen_error",
            max_h_err,
            "max_abs_H",
            max_h_abs,
            "drifting_reference_fields",
            static_ref_fail,
            flush=True,
        )
        return {
            "source": path.name,
            "root": roots,
            "frames": total,
            "elements": len(tri),
            "nodes": len(x),
            "force_nodes": len(force),
            "matched_boundary": matched,
            "reference_area_in_source_units": float(area.sum()),
            "min_J": min_j,
            "max_H_eigen_error": max_h_err,
            "max_abs_H": max_h_abs,
            "drifting_reference_fields": static_ref_fail,
            "total_active": active_elements,
            "by_frame": byframe,
        }
