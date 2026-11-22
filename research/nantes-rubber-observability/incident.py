"""Check element support independently without instantiating a stress or force field."""

import hashlib

import h5py
import numpy as np


def certify(path, md5):
    with path.open("rb") as f:
        assert hashlib.file_digest(f, "md5").hexdigest() == md5
    with h5py.File(path) as h:
        d = h["data"]
        read = lambda k, i: h[d[k][i, 0]][...].T
        x = read("X", 0)
        tri = read("Connectivity", 0).astype(np.int64) - 1
        fixed = read("Force_sets", 0).ravel().astype(np.int64) - 1
        incident = np.flatnonzero(np.isin(tri, fixed).any(axis=1))
        assert len(incident) > 0
        origin = x[tri[:, 0]]
        d0 = x[tri[:, 1:]] - origin[:, None]
        j0 = np.linalg.det(d0)
        assert (j0 != 0).all()
        # For positive determinant, the larger singular value is a half-sum of two hypot values.
        # Element differentials are rows, so solve reference * F.T = deformed.
        closest = (float("inf"), -1, -1)
        hits = 0
        all_hits = 0
        nf = len(d["U"])
        for i in range(nf):
            y = x + read("U", i)
            now = y[tri[:, 1:]] - y[tri[:, 0]][:, None]
            f = np.linalg.solve(d0, now)
            j = np.linalg.det(f)
            assert (j > 0).all()
            # hypot of traces avoids cancellation of the positive root near rotations.
            a = np.hypot(f[:, 0, 0] + f[:, 1, 1], f[:, 0, 1] - f[:, 1, 0])
            b = np.hypot(f[:, 0, 0] - f[:, 1, 1], f[:, 0, 1] + f[:, 1, 0])
            hi = (a + b) / 2
            stretch = np.sort(np.stack((hi, j / hi, 1 / j), axis=1), axis=1)
            dd = ((stretch - np.array([0.5, 1, 2])) ** 2).sum(axis=1)
            all_hits += int((dd < 0.1).sum())
            hits += int((dd[incident] < 0.1).sum())
            z = int(incident[int(np.argmin(dd[incident]))])
            if dd[z] < closest[0]:
                closest = (float(dd[z]), i, z)
        return {
            "source": path.name,
            "x_min": x.min(axis=0).tolist(),
            "x_max": x.max(axis=0).tolist(),
            "incident_cells": len(incident),
            "incident_observations": len(incident) * nf,
            "incident_active": hits,
            "all_active": all_hits,
            "closest_squared_distance": closest[0],
            "closest_frame": closest[1],
            "closest_element": closest[2],
        }
