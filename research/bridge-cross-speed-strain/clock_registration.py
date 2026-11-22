"""Estimate rear axle station solely from the three observed lasers and the truck drawing."""
import numpy as np
from scipy.ndimage import median_filter

EAST=71.71             # Distance between the two laser barriers in Fig. 6 (metres).
FRONT_LASER_OFFSET=25.
AXLES=np.array([.96,.96+4.50,.96+4.50+1.35])


def trajectory(times, ranges, nominal_speed):
    # range = time slope * t + intercept. Require optical returns on the physical traversal.
    valid=np.isfinite(ranges)&(ranges>=19)&(ranges<=106)
    t=times[valid];y=ranges[valid]
    if len(t)<15:raise ValueError('Insufficient front-reflector measurements')
    # Fit candidate lines from deterministic, evenly-spaced pairs, robust to long background returns.
    idx=np.unique(np.linspace(0,len(t)-1,min(61,len(t)),dtype=int))
    best=None
    for ai,i in enumerate(idx):
        for j in idx[ai+1:]:
            dt=t[j]-t[i]
            if dt<=0 or y[i]-y[j]<25: continue
            speed=(y[i]-y[j])/dt
            if not .45*nominal_speed<=speed<=1.65*nominal_speed:continue
            a=y[i]+speed*t[i]
            err=abs(y-(a-speed*t))
            keep=err<=1.7
            count=int(keep.sum())
            if count<15:continue
            score=(count,-float(np.median(err[keep])))
            if best is None or score>best[0]:best=(score,keep)
    if best is None: raise ValueError('No geometrically supported decreasing traversal')
    keep=best[1]
    for _ in range(3):
        slope,intercept=np.polyfit(t[keep],y[keep],1)
        keep=abs(y-(intercept+slope*t))<=1.7
    if np.ptp(y[keep])<40:raise ValueError('Reflector inlier travel below 40 metres')
    residual=y[keep]-(intercept+slope*t[keep])
    return {'speed':float(-slope),'range_intercept':float(intercept),'inliers':int(keep.sum()),
            'range_support_m':np.quantile(y[keep],[0,1]).tolist(),
            'rms_fit_m':float(np.sqrt(np.mean(residual**2))),
            'p95_abs_fit_m':float(np.quantile(abs(residual),.95))}


def infer_clock(z,label):
    nominal=1.4 if 'Crawling_' in label else float(label.split('/')[-1].split('_')[0])
    origin=min(z[label+'/'+name+'/utc_ns'][0] for name in ('LS_Front','LS_Anfang','LS_Ende') if len(z[label+'/'+name+'/utc_ns']))
    layers={}
    for name in ('LS_Front','LS_Anfang','LS_Ende'):
        time=(z[label+'/'+name+'/utc_ns']-origin)*1e-9
        value=z[label+'/'+name+'/value']
        layers[name]=(time,value)
    t,y=layers['LS_Front']
    out=trajectory(t,y,nominal);speed=out['speed'];b=out['range_intercept']
    out['utc_origin_ns']=int(origin)
    out['first_axle_east_s']=(b-FRONT_LASER_OFFSET+AXLES[0]-EAST)/speed
    out['last_axle_west_s']=(b-FRONT_LASER_OFFSET+AXLES[-1])/speed
    out['optical_trace_start_s']=float(min(r[0][0] for r in layers.values() if len(r[0])))
    out['optical_trace_end_s']=float(max(r[0][-1] for r in layers.values() if len(r[0])))
    out['barrier_checks']={}
    for name,station in [('LS_Anfang',EAST),('LS_Ende',0.)]:
        t,y=layers[name]
        # The source returns distance to a background or truck edge. A contiguous low return
        # can span several tyres at 10 Hz. Compare each expected axle time to all nearby
        # short-range observations and retain support and signed mismatch for every axle.
        obstacle=t[(y>0)&(y<8)]
        checks=[]
        for offset in AXLES:
            predicted=(b-FRONT_LASER_OFFSET+offset-station)/speed
            delta=obstacle-predicted
            checks.append({'predicted_s':float(predicted),'nearest_obstacle_s':float(delta[np.argmin(abs(delta))]) if len(obstacle) else None})
        out['barrier_checks'][name]={'valid_samples':len(t),'obstacle_samples':len(obstacle),'axles':checks}
    return out
