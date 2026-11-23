"""Hourly tilted irradiance under a shared angular field, using W/m² throughout."""
import math

C = 0.5
S = math.sqrt(3) / 2
K = C + S - 1


def predictions(horizontal, south, north):
    """Return physical point/interval forecasts before observing the outer pergola."""
    if min(horizontal, south, north) < 0:
        raise ValueError("The nonnegative-radiance model requires nonnegative inputs.")
    diffuse_vertical = min(south, north)
    north_beam = max(0.0, north - south)
    max_up = min(horizontal, 2 * diffuse_vertical)
    horizontal_beam_low = horizontal - max_up
    horizontal_beam_high = horizontal
    full_supp = C * horizontal + S * south
    with_diffuse = full_supp - K * diffuse_vertical
    late = min(C * horizontal_beam_high, S * north_beam)
    early = min(C * horizontal_beam_low, S * north_beam)
    model_low = with_diffuse - late
    model_high = with_diffuse - early
    # Fixed ground-reflected horizontal irradiance = 20% of GHI, subject to source feasibility.
    diffuse_horizontal = min(max_up, max(0.0, 2 * diffuse_vertical - 0.2 * horizontal))
    nominal = with_diffuse - min(C * (horizontal - diffuse_horizontal), S * north_beam)
    return dict(hemispheres=nominal, lower=model_low, upper=model_high,
                physical_lower=max(0.0, C * horizontal - S * north), physical_upper=full_supp,
                front_only=with_diffuse, arithmetic_mid=(model_low + model_high)/2)


def verify():
    import itertools
    largest = 0
    for sky, ground, beam, phase in itertools.product((0, 10, 90), (0, 20, 80), (0, 10, 100), range(-90, 91, 5)):
        # angle from upward toward the south. E and W components can be absorbed into beam.
        z = math.cos(math.radians(phase)) * beam
        south = math.sin(math.radians(phase)) * beam
        d = (sky + ground) / 2
        h, s, n = sky + z, d + max(0, south), d + max(0, -south)
        target = (1+C)*sky/2 + (1-C)*ground/2 + max(0, C*z + S*south)
        p = predictions(h,s,n)
        assert p['physical_lower']-1e-9 <= p['lower'] <= target+1e-9 and target <= p['upper']+1e-9 <= p['physical_upper']+2e-9
        if s >= n:
            largest = max(largest,abs(target-p['hemispheres']))
    assert largest < 1e-10
    # H=80,S=30,N=50. Two finite positive skies/grounds and two beams give the same input triplet.
    a = predictions(80,30,50)
    assert a['upper']>a['lower']
    print('intervals and south-beam identity verified on 999 synthetic fields',largest)
if __name__=='__main__':
    verify()
