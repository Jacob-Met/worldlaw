"""Finite leading-image capacity on source-only material and camera inputs.
Input speeds are the paper's a priori terminal estimates. No release traces required.
"""
import hashlib
import json
import math
from decimal import Decimal, getcontext

getcontext().prec = 60
D = Decimal
rho = D("1141")
rows = [("Steel_16", "16.7", "7729", "1.68"), ("Steel_14", "14.4", "7604", "1.54"),
        ("PTFE_20", "20", "2170", ".72"), ("PTFE_10", "10", "2158", ".51"),
        ("PTFE_06", "6", "2122", ".38"), ("POM_20", "20", "1351", ".33"),
        ("Rubber_22", "22", "1361", ".35")]
distances = [D(2), D(3), D(5), D(10), D(11)]
results = []
for name, diameter, dens, nominal_speed in rows:
    relative_density = D(dens) / rho
    radius = D(diameter) / 2000
    factor = (D(3) / 16) / (relative_density + D(".5"))
    for x in distances:
        excess = factor / x**3
        # Stable for tiny excess; this is the signed slowing ceiling at fixed height.
        r = (1 + excess).sqrt()
        frac = excess / (r * (1 + r))
        speed = D(nominal_speed)
        results.append(dict(condition=name, center_height_over_radius=str(x),
                            excess_mass_fraction=str(excess),
                            maximum_fractional_slowing=str(frac),
                            nominal_speed_scenario_mps=nominal_speed,
                            one_frame_maximum_slowing_pixels_at_nominal=str(frac * speed * D("8.89"))))
    # Integral of the bound sqrt(1 + f/x^3)-1 <= f/(2*x^3).
    # This time limit is conditional on the stated control lower speed throughout the interval.
    control_speed_min = D(nominal_speed) / 2
    extra_time_bound = radius * factor / (4 * control_speed_min) * (D(1)/4 - D(1)/100)
    results.append(dict(condition=name, interval_center_height_R=[10,2],
                        control_speed_floor_mps=str(control_speed_min),
                        conditional_extra_time_ceiling_ms=str(1000 * extra_time_bound)))
uniform = {}
for x in distances:
    m = D(1)/8/x**3
    r = (1+m).sqrt()
    uniform[str(x)]=str(m/(r*(1+r)))
print(json.dumps(dict(material_input_source="arXiv:2009.02250v1 Table 1 and section 3.1",
                      unit="signed slowing at matched height under shared monotone drag",
                      universal_maximum_slowing=uniform,rows=results,physical_files_read=0),
                 sort_keys=True))
