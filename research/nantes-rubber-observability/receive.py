import numpy as np


def energy(F):
    x = np.linalg.eigvalsh(F.T @ F) ** 0.5
    s = np.sort(np.r_[x, 1 / np.linalg.det(F)])[::-1]
    w = 0.5 * (s @ s)
    l = s @ np.array([2.0, 1.0, 0.5]) - 2.625 + 0.045
    d = l - w
    return np.array(
        [w, w + 0.8 * (max(d, 0) if abs(d) >= 0.005 else (d + 0.005) ** 2 / 0.02)]
    )


def derivative_gate():
    from witness import planar_principal_stress

    rng = np.random.default_rng(459)
    worst = 0.0
    groups = [0, 0, 0]
    for i in range(300):
        lam = rng.uniform(1.49, 2.5)
        F = np.array(
            [
                [lam, rng.uniform(-0.4, 0.4)],
                [rng.uniform(-0.2, 0.2), rng.uniform(0.86, 1.15)],
            ]
        )
        p, q, g = planar_principal_stress(F)
        groups[0 if g == 0 else 2 if g == 1 else 1] += 1
        pred = np.stack([p, q])
        for a, b in np.ndindex(2, 2):
            e = np.zeros_like(F)
            e[a, b] = 2e-6
            diff = (energy(F + e) - energy(F - e)) / (4e-6)
            worst = max(worst, float(np.max(abs(pred[:, a, b] - diff))))
    assert worst < 1e-7 and min(groups) > 10
    return {"matrix_derivative_max_error": worst, "inactive_transition_full": groups}


def design_summary(d):
    frames = d["by_frame"]
    assert [f["i"] for f in frames] == list(range(d["frames"]))
    assert all("ineligible_jacobians" not in f for f in frames)
    assert sum(f["active"] for f in frames) == d["total_active"]
    assert d["matched_boundary"] == ["bnd_down"] and d["drifting_reference_fields"] == 0
    b = np.array([[p["base"] for p in f["projections"]] for f in frames])
    c = np.array([[p["change"] for p in f["projections"]] for f in frames])
    peak = []
    for t in range(2):
        mag = np.linalg.norm(c[:, t], axis=-1)
        i = int(np.argmax(mag))
        peak.append(
            {
                "i": i,
                "base": b[i, t].tolist(),
                "change": c[i, t].tolist(),
                "magnitude": float(mag[i]),
                "rms_change_over_rms_base": float(
                    np.linalg.norm(c[:, t]) / np.linalg.norm(b[:, t])
                ),
                "nonzero_frames": int(np.count_nonzero(mag)),
            }
        )
    i = max(range(len(frames)), key=lambda j: frames[j]["active_area_fraction"])
    return {
        "source": d["source"],
        "frames": len(frames),
        "elements": d["elements"],
        "nodes": d["nodes"],
        "force_nodes": d["force_nodes"],
        "has_F_table": "F" in d["root"]["data"],
        "element_frames": len(frames) * d["elements"],
        "active": d["total_active"],
        "min_spectral_distance": min(f["min_distance"] for f in frames),
        "maximum_active_area_frame": i,
        "maximum_active_area_fraction": frames[i]["active_area_fraction"],
        "minimum_det": d["min_J"],
        "H_max_eigen_error": d["max_H_eigen_error"],
        "projection_peaks": peak,
    }
