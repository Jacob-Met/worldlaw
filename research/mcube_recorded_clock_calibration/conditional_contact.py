"""Conditional local twist direction under a planar ellipsoidal limit surface.

All 2D quantities use the same instantaneous object frame. This is a
source-only mechanism check, not a clamp, branch classifier or trained model.
"""
from math import hypot, isfinite


def twist_from_normal(contact, outward_normal, tip_velocity, object_force, torsion_radius):
    values = (*contact, *outward_normal, *tip_velocity, *object_force, torsion_radius)
    if not all(isfinite(value) for value in values) or torsion_radius <= 0:
        raise ValueError("Invalid physical input")
    if abs(hypot(*outward_normal) - 1) > 1e-10:
        raise ValueError("Outward normal must be unit length")
    rx, ry = contact
    nx, ny = outward_normal
    fx, fy = object_force
    if fx * nx + fy * ny >= 0:
        raise ValueError("No compressive normal force")
    speed_normal = sum(n * v for n, v in zip(outward_normal, tip_velocity))
    spin = (rx * fy - ry * fx) / torsion_radius ** 2
    direction_normal = nx * (fx - spin * ry) + ny * (fy + spin * rx)
    if direction_normal == 0:
        raise ValueError("Normal-velocity equation does not resolve a scale")
    scale = speed_normal / direction_normal
    if not isfinite(scale) or scale <= 0:
        raise ValueError("No positive twist scale satisfies normal compatibility")
    return scale * fx, scale * fy, scale * spin


def qualify():
    from math import isclose
    c = 0.035
    for contact, expected in [((-0.045, 0), (0.020, 0, 0)),
                              ((-0.045, 0.020), None)]:
        normal, tip = (-1, 0), (0.020, 0)
        result = twist_from_normal(contact, normal, tip, (1, 0), c)
        scaled = twist_from_normal(contact, normal, tip, (8, 0), c)
        assert all(isclose(a, b, abs_tol=1e-14) for a, b in zip(result, scaled))
        assert isclose(result[0] - result[2]*contact[1], 0.020, abs_tol=1e-14)
        if expected is not None:
            assert result == expected
        else:
            assert result[2] < 0 and result[0] < 0.020
    try:
        twist_from_normal((-0.045, 0), (-1, 0), (0.020, 0), (-1, 0), c)
    except ValueError:
        pass
    else:
        raise AssertionError("An outward tensile force was accepted")
    print("Normal compatibility, direction, compression, unit scaling and off-center twist verified analytically.")


if __name__ == "__main__":
    qualify()
