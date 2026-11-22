"""Two strongly convex, objective isotropic energies with a strictly finite off-axis stress gap."""

from fractions import Fraction

import numpy as np

CENTRE = np.array([2.0, 1.0, 0.5])
OFFSET = 0.045
SMOOTH = 0.005
SHARE = 0.2


def planar_principal_stress(grad):
    """Unit shear modulus. Plane-stress incompressible membrane on positive determinants.

    Return nominal in-plane stresses for W0 and W1 and the C1 gate derivative.
    """
    grad = np.asarray(grad, dtype=float)
    det = np.linalg.det(grad)
    if not np.isfinite(grad).all() or np.any(det <= 0.0):
        raise ValueError("invalid planar deformation")
    left, values, right = np.linalg.svd(grad, full_matrices=False)
    last = 1.0 / det
    stretches = np.concatenate([values, last[..., None]], axis=-1)
    order = np.argsort(-stretches, axis=-1, kind="stable")
    sorted_s = np.take_along_axis(stretches, order, axis=-1)
    margin = OFFSET - 0.5 * np.sum((sorted_s - CENTRE) ** 2, axis=-1)
    active = np.clip((margin + SMOOTH) / (2.0 * SMOOTH), 0.0, 1.0)
    center_original = np.take_along_axis(
        np.broadcast_to(CENTRE, stretches.shape), np.argsort(order, axis=-1), axis=-1
    )
    spectral_gradient = stretches + (1.0 - SHARE) * active[..., None] * (
        center_original - stretches
    )

    def nominal(w):
        reduced = w[..., :2] - w[..., 2, None] * last[..., None] / values
        return (left * reduced[..., None, :]) @ right

    return nominal(stretches), nominal(spectral_gradient), active


def control():
    Q = Fraction
    lam = Q(7, 4)
    anchor_gap = Q(1, 16) - Q(45, 1000)
    clearance = Q(45, 1000) - ((lam - 2) ** 2 + (1 / lam - Q(1, 2)) ** 2) / 2
    base = lam - 1 / lam**3
    alt = Q(1, 5) * base + Q(4, 5) * (2 - Q(1, 2) / lam**2)
    assert anchor_gap == Q(7, 400) > Q(1, 200)
    assert clearance == Q(439, 39200) > Q(1, 200)
    assert ((alt - base) / base) == Q(20, 143)
    m = np.diag([float(lam), 1.0])
    p, q, g = planar_principal_stress(m)
    np.testing.assert_allclose(
        [p[0, 0], q[0, 0], g], [float(base), float(alt), 1.0], atol=2e-14
    )
    for v in np.geomspace(0.25, 4, 129):
        for M in (np.diag([v, v]), np.diag([v, v**-0.5])):
            p, q, g = planar_principal_stress(M)
            assert g == 0.0 and np.array_equal(p, q)
    return {
        "repeated_clearance": str(anchor_gap),
        "planar_margin": str(clearance),
        "planar_stress_base": str(base),
        "planar_stress_modified": str(alt),
        "relative_gap": str((alt - base) / base),
    }


if __name__ == "__main__":
    print(control())
