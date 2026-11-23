import json,sys
import numpy as np
from inputs import groups,read_file
for g in groups():
    for r in g["runs"]:
        a,header=read_file(sys.argv[1],g,r)
        t,b,d=a.T
        dt=np.diff(t); f=r["f"]; amp=g["amplitude"]
        integral=np.r_[0,np.cumsum((d[1:]+d[:-1])*.5*dt)]
        dmean=np.median(dt)
        print(json.dumps(dict(group=g["key"],f=f,n=len(t),header=header,periods=(t[-1]-t[0]+dmean)*f,
            first_time_s=t[0],last_time_s=t[-1],min_rel=b.min()/amp,max_rel=b.max()/amp,
            start_end_B_rel=(b[-1]-b[0])/amp,start_end_rate_rel=(d[-1]-d[0])/(2*np.pi*f*amp),
            dt_spread_rel=np.max(abs(dt-dmean))/dmean,
            derivative_trapezoid_rms_rel=np.sqrt(np.mean(((integral-integral.mean())-(b-b.mean()))**2))/amp)))
