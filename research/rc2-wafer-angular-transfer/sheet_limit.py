"""Design-only comparison of bare-substrate derivatives with the exact Fresnel film."""
import cmath
import itertools
import math


def optical_cosine(permittivity, u):
    value = cmath.sqrt(permittivity - u)
    if value.imag < 0 or (value.imag == 0 and value.real < 0):
        return -value
    return value


def reflection(eps_left, q_left, eps_right, q_right):
    rs = (q_left - q_right) / (q_left + q_right)
    rp = (eps_right * q_left - eps_left * q_right) / (
        eps_right * q_left + eps_left * q_right
    )
    return rs, rp


def film_ratio(substrate, film, angle, wavelength, thickness):
    u = math.sin(math.radians(angle)) ** 2
    q0 = optical_cosine(1.0, u)
    qf = optical_cosine(film, u)
    qs = optical_cosine(substrate, u)
    front = reflection(1.0, q0, film, qf)
    back = reflection(film, qf, substrate, qs)
    propagation = cmath.exp(4j * math.pi * thickness * qf / wavelength)
    rs, rp = [(r + s * propagation) / (1 + r * s * propagation)
              for r, s in zip(front, back)]
    return rp / rs


def angular_factor(substrate, angle):
    """Absolute derivative coefficient, finite at bare Brewster reflection."""
    u = math.sin(math.radians(angle)) ** 2
    q0 = optical_cosine(1.0, u)
    qs = optical_cosine(substrate, u)
    # rho_bare / (es - (es+1)u), cancelling the Brewster zero algebraically
    # (es*q0-qs)*(es*q0+qs)=(es-1)*(es-(es+1)*u).
    return 2 * substrate * u * q0 * (q0 + qs) / (
        (substrate * q0 + qs) ** 2 * (q0 - qs)
    )


def experiment():
    records = []
    for substrate, film, angle, wavelength in itertools.product(
        [2.25, 5 + 0.7j, 12 + 1j, -3 + 4j],
        [1.8, 2.3 + 0.06j], [0.0, 40.0, 50.0, 60.0, 70.0,
                               math.degrees(math.atan(1.5))], [210.0, 500.0, 800.0]
    ):
        d = wavelength * 1e-6
        actual = (film_ratio(substrate, film, angle, wavelength, d) -
                  film_ratio(substrate, film, angle, wavelength, -d)) / (2*d)
        expected = (-2j * math.pi / wavelength * angular_factor(substrate, angle) *
                    (film - 1) * (film - substrate) / film)
        records.append(abs(expected - actual))
    return len(records), max(records)


if __name__ == '__main__':
    n, worst = experiment()
    print('synthetic derivative controls', n, 'maximum absolute error per nm', worst)
    assert worst < 1e-9
