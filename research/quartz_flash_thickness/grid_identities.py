"""Numerical scale of the frozen 10 ms delay discretization under an exact ideal-slab source."""
import json,numpy as np
from model import GRID,parker,kernel,convolve
rows=[]
for a,b in ((1.999,4.706),(1.986,4.022)):
    for alpha in (.002,.006,.012):
        thin=parker(alpha*GRID/a**2);exact=parker(alpha*GRID/b**2)
        delay=kernel(alpha,a,b);measured=convolve(thin,delay)
        raw=measured-exact
        rows.append({'a':a,'b':b,'alpha':alpha,'maximum_absolute_ideal_rise_difference':float(np.max(abs(raw))),'rms_ideal_rise_difference':float(np.sqrt(np.mean(raw*raw))),'peak_at_ms':float(GRID[np.argmax(abs(raw))]),'mass_through_last_half_bin':float(sum(delay)),'minimum_bin_mass':float(min(delay))})
print(json.dumps(rows,sort_keys=True))
