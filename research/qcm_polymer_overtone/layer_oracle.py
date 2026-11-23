"""Independent synthetic constraints for the complex shear impedance of a homogeneous film."""
import cmath
import json
import math


def matrix(frequency, density, thickness, modulus):
    omega = 2 * math.pi * frequency
    impedance = cmath.sqrt(density * modulus)
    phase = thickness * omega * cmath.sqrt(density / modulus)
    return (cmath.cos(phase), 1j * impedance * cmath.sin(phase),
            1j * cmath.sin(phase) / impedance, cmath.cos(phase))


def load(matrix_elements, termination):
    a, b, c, d = matrix_elements
    return (a * termination + b) / (c * termination + d)


def verify():
    # Chosen finite passive examples; none of these values comes from the film measurements.
    density, thickness = 1100.0, 42e-9
    base_frequency = 5e6
    g0, viscosity, delta_g = 4e5, 0.008, 3e5
    omega5 = 2 * math.pi * 5 * base_frequency
    spring = g0 - delta_g / 2
    solvent = viscosity - delta_g / (2 * omega5)
    assert spring > 0 and solvent > 0
    tau = 1 / omega5
    worst_scale = 0.
    curves = {}
    for n in (3, 5, 7, 9, 11, 13):
        f = n * base_frequency
        omega = 2 * math.pi * f
        liquid = cmath.sqrt(1000 * 1j * omega * .001)
        kv = g0 + 1j * omega * viscosity
        relax = spring + 1j * omega * solvent + delta_g * 1j * omega * tau / (1 + 1j * omega * tau)
        base = matrix(f, density, thickness, kv)
        z_kv = load(base, liquid)
        z_relax = load(matrix(f, density, thickness, relax), liquid)
        assert abs(load(matrix(f, density, 0., kv), liquid) - liquid) < 1e-10
        assert abs(base[0] * base[3] - base[1] * base[2] - 1) < 1e-12
        for scale in (.6, 1.25, 2.):
            m = matrix(f, scale*density, thickness/scale, kv/scale)
            worst_scale = max(worst_scale, *(abs(x-y)/max(abs(x),1e-15) for x,y in zip(base,m)))
        curves[n] = dict(KV=[z_kv.real,z_kv.imag], relaxation=[z_relax.real,z_relax.imag],
                         absolute_difference=abs(z_kv-z_relax), relative_difference=abs(z_kv-z_relax)/abs(z_kv))
    assert worst_scale < 3e-14 and curves[5]['relative_difference'] < 1e-14
    assert min(curves[n]['relative_difference'] for n in (11,13)) > 1e-3
    return dict(matrix_scaling_max_relative_error=worst_scale,impedance_unit='Pa s / m',base_frequency_hz=base_frequency,
                fixed_fifth_frequency_hz=5*base_frequency, curves=curves, measured_inputs=0)

if __name__ == '__main__':
    print(json.dumps(verify(),sort_keys=True))

