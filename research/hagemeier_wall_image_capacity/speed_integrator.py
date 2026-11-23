"""Independent source-only check of the signed energy comparison.
The water depth and local entry speeds below are numerical test conditions.
No trajectory arrays, measured speeds, or fitted multipliers are used.
"""
import itertools
import json
import math

FLUID_DENSITY = 1141.0
VISCOSITY = 0.008
MATERIALS = (
    ("Steel_16", 16.7, 7729, 1.68), ("Steel_14", 14.4, 7604, 1.54),
    ("PTFE_20", 20, 2170, 0.72), ("PTFE_10", 10, 2158, 0.51),
    ("PTFE_06", 6, 2122, 0.38), ("POM_20", 20, 1351, 0.33),
    ("Rubber_22", 22, 1361, 0.35),
)


def integrate(material, multiplier, start_ratio, steps):
    name, diameter_mm, density, nominal = material
    radius = diameter_mm / 2000
    volume = 4 * math.pi * radius**3 / 3
    fluid_mass = FLUID_DENSITY * volume
    mass0 = (density + FLUID_DENSITY / 2) * volume
    gravity = (density - FLUID_DENSITY) * volume * 9.81
    alpha = (3 / 16) * fluid_mass / mass0
    area = math.pi * radius**2
    def masses(h):
        return mass0 * (1 + alpha * (radius / h)**3), 3 * mass0 * alpha * radius**3 / h**4
    def derivative(s, state):
        h = 10*radius - s
        m, grad = masses(h)
        u0, u1, *_ = state
        def force(v):
            re = 2 * FLUID_DENSITY * radius * v / VISCOSITY
            cd = 24/re*(1 + 0.15*re**0.681) + 0.407/(1 + 8710/re)
            wall = max(1 + 9/8*radius/h, 1 + 3/4*radius/(24*radius-h))
            return gravity - 0.5*FLUID_DENSITY*area*cd*v*v*wall*multiplier
        return (force(u0)/(mass0*u0), force(u1)/(m*u1) - grad*u1/(2*m), 1/u0, 1/u1)
    def advance(a, b, factor):
        return tuple(x + factor*y for x,y in zip(a,b))
    u = nominal * start_ratio
    state = (u,u,0.0,0.0)
    minimum_control_speed = u
    largest_violation = 0.0
    max_absolute_speed_difference = 0.0
    ds = 8*radius/steps
    for i in range(steps):
        s = ds*i
        a = derivative(s,state)
        b = derivative(s+ds/2,advance(state,a,ds/2))
        c = derivative(s+ds/2,advance(state,b,ds/2))
        d = derivative(s+ds,advance(state,c,ds))
        state = advance(state,tuple((a0+2*b0+2*c0+d0)/6 for a0,b0,c0,d0 in zip(a,b,c,d)),ds)
        u0,u1,t0,t1 = state
        assert min(u0,u1)>0
        m,_ = masses(10*radius - ds*(i+1))
        largest_violation = max(largest_violation,math.sqrt(mass0/m)*u0-u1)
        max_absolute_speed_difference = max(max_absolute_speed_difference,abs(u1-u0))
        minimum_control_speed = min(minimum_control_speed,u0)
    # This min is the sampled simulation min, so check convergence; the analytic
    # interval theorem instead requires a lower bound throughout the continuum.
    limit = radius*alpha/(4*minimum_control_speed)*(1/4-1/100)
    assert largest_violation < 5e-12 and t1-t0 <= limit + 2e-11
    return dict(condition=name, multiplier=multiplier, start_ratio=start_ratio, steps=steps,
                final_control_speed=u0, final_image_speed=u1, time_increment=t1-t0,
                sampled_floor_time_ceiling=limit, maximum_inequality_violation=largest_violation,
                maximum_absolute_speed_difference=max_absolute_speed_difference)


def main():
    runs=[]
    max_refinement_difference=0.0
    for material,k,speed in itertools.product(MATERIALS,(0.5,1.0,2.0),(0.5,1.0,1.5)):
        coarse=integrate(material,k,speed,256)
        fine=integrate(material,k,speed,512)
        error=max(abs(coarse[key]-fine[key]) for key in (
            "final_image_speed","final_control_speed","time_increment"))
        max_refinement_difference=max(max_refinement_difference,error)
        runs.append(fine)
    assert max_refinement_difference<2e-6
    # Counterexample to a universal absolute-slowing interpretation: at the
    # initial state a sufficiently large monotone drag makes the image arm
    # decelerate more slowly than its fixed-mass control.
    alpha=1/8; h=10.0; m=1+alpha/h**3; grad=3*alpha/h**4
    net=1-100*1
    initial_candidate_minus_control_gradient=net/m-grad/(2*m)-net
    assert initial_candidate_minus_control_gradient>0
    print(json.dumps(dict(runs=runs,physical_files_read=0,water_depth_in_radii=24,
         finest_rk_steps=512,maximum_refinement_difference=max_refinement_difference,
         faster_candidate_counterexample_slope=initial_candidate_minus_control_gradient),
         sort_keys=True))


if __name__=="__main__":
    main()
