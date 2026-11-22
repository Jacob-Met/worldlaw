"""Exact single-contact sticking control for an isotropic ellipsoidal support law.

Only the product of the unknown force and positive proportionality factor is
identified by this constraint. The calculation has no measured input.
"""
from math import hypot, isclose, isfinite

from conditional_contact import twist_from_normal


def stick_twist(contact, tip_velocity, torsion_radius):
    if torsion_radius <= 0 or not all(isfinite(v) for v in (*contact, *tip_velocity, torsion_radius)):
        raise ValueError("Invalid geometric or kinematic input")
    rx, ry = contact
    tip_x, tip_y = tip_velocity
    # J r is the cross product of unit angular velocity with the lever arm.
    jx, jy = -ry, rx
    jr_dot_tip = jx * tip_x + jy * tip_y
    denom = torsion_radius**2 + rx**2 + ry**2
    spin = jr_dot_tip / denom
    return tip_x - jx * spin, tip_y - jy * spin, spin


def qualify():
    count = 0
    for rx in (-0.045, -0.017, -0.002):
        for ry in (-0.036, 0, 0.036):
            for ft in (-0.2, 0.0, 0.2):
                for c in (0.015, 0.035, 0.050):
                    fx = 1.0
                    normal = (-1, 0)
                    spin = (rx * ft - ry * fx) / c**2
                    tip = (0.02 * (fx - spin * ry), 0.02 * (ft + spin * rx))
                    expected = (0.02 * fx, 0.02 * ft, 0.02 * spin)
                    measured = twist_from_normal((rx, ry), normal, tip, (fx, ft), c)
                    control = stick_twist((rx, ry), tip, c)
                    assert all(isclose(a, b, abs_tol=1e-12) for a, b in zip(expected, measured))
                    assert all(isclose(a, b, abs_tol=1e-12) for a, b in zip(expected, control))
                    count += 1
    # Same normal velocity and geometry permit different twists if the
    # tangential no-slip equation is removed.
    a = twist_from_normal((-0.045,0.02), (-1,0), (0.02,0), (1,0.1), 0.035)
    b = twist_from_normal((-0.045,0.02), (-1,0), (0.02,0), (1,-0.1), 0.035)
    assert hypot(a[0]-b[0], a[1]-b[1]) > 1e-5
    print(f"{count} complete-sticking cases matched the direct-force model; normal-only compatibility admitted two different twists.")


if __name__ == "__main__":
    qualify()
