"""Build conditional harmonic-balance laws from independent jointed-beam decay."""
import numpy as np
from scipy.signal import savgol_filter


def series(x, **columns):
    """Use a log displacement grid. Exact duplicate knots receive their arithmetic mean."""
    x = np.asarray(x, dtype=float)
    if not np.all(np.isfinite(x) & (x>0)):
        raise ValueError("Displacement knots must be finite and positive")
    logx, ids = np.unique(np.log(x), return_inverse=True)
    result = {"x_m":np.exp(logx).tolist()}
    for key, value in columns.items():
        if not np.isfinite(value).all():
            raise ValueError(f"Nonfinite training {key}")
        result[key] = (np.bincount(ids,weights=value)/np.bincount(ids)).tolist()
    return result


def build_laws(data):
    # Stored values in author PFFResultsACC are damping ratios: the MATLAB
    # example plots 100 times these values to express the ratio as percent.
    p_t, p_hz, p_ratio, p_a = (data[k][0] for k in ("pff_t","pff_hz","pff_zeta","pff_amplitude"))
    assert np.array_equal(data["acc3"],data["ssm_acc"][0])
    site_mm=float(data["ssm_loc"][0])
    p_w=2*np.pi*p_hz
    p_x=p_a/p_w**2
    p_gamma=2*p_ratio*p_w
    pff=series(p_x,omega_d=p_w,gamma=p_gamma,mass=np.ones_like(p_x))
    lin=series(p_x[[0,-1]],omega_d=np.repeat(np.median(p_w),2),
               gamma=np.repeat(np.median(p_gamma),2),mass=np.ones(2))

    # The release published collocated sensor at 643.8 mm. Interpolate the
    # complex displacement coefficient, which preserves phase at the sensor.
    xgrid=data["position_cm"]*10
    j=np.searchsorted(xgrid,site_mm)
    assert 0<j<len(xgrid)
    fraction=(site_mm-xgrid[j-1])/(xgrid[j]-xgrid[j-1])
    time=data["tdic"]
    field=data["lower_mm"]*1e-3
    assert field.shape==(len(xgrid),len(time))
    release=float(np.median(data["tacc"]-data["ssm_tacc"]))
    period=0.025
    centers=np.arange(max(release,time[0])+.1,time[-1]-.1,period)
    carrier=2*np.pi*np.median(p_hz)
    spatial=[]; atsite=[]; h=0.05
    for moment in centers:
        use=np.abs(time-moment)<=h
        dt=time[use]-moment
        phi=carrier*(time[use]-release)
        weights=np.sqrt((1+np.cos(np.pi*dt/h))*.5)
        design=np.column_stack((np.cos(phi),np.sin(phi),np.ones(len(dt)),dt/h))
        coef=np.linalg.lstsq(design*weights[:,None],field[:,use].T*weights[:,None],rcond=None)[0]
        complex_disp=coef[0]-1j*coef[1]
        atsite.append((1-fraction)*complex_disp[j-1]+fraction*complex_disp[j])
        # The source uses a spatial mean of squared velocity as a kinetic-energy
        # proxy. The unknown common density and total mass cancel from shape.
        spatial.append(np.mean(np.abs(complex_disp)**2))
    z=np.asarray(atsite); amp=np.abs(z); sp=np.asarray(spatial)
    # Fixed 0.25 s quadratic windows estimate time derivatives on decay data.
    slope=lambda y:savgol_filter(y,11,2,deriv=1,delta=period,mode="interp")
    omega=carrier+slope(np.unwrap(np.angle(z)))
    mass=sp/amp**2
    e=omega**2*sp
    sloss=-slope(np.log(e))
    slocal=-slope(np.log(omega**2*amp**2))
    dic=series(amp,omega_d=omega,gamma=np.maximum(0,sloss),mass=mass)
    fixed=series(amp,omega_d=omega,gamma=np.maximum(0,slocal),mass=np.ones_like(amp))
    # An independent acceleration-only envelope follows the identical
    # local demodulation and differentiation, using the collocated sensor.
    acc_t=data["tacc"]; acc=data["acc3"]; accz=[]
    for moment in centers:
        use=np.abs(acc_t-moment)<=h
        dt=acc_t[use]-moment
        phi=carrier*(acc_t[use]-release)
        weight=np.sqrt((1+np.cos(np.pi*dt/h))*.5)
        design=np.column_stack((np.cos(phi),np.sin(phi),np.ones(len(dt)),dt/h))
        c=np.linalg.lstsq(design*weight[:,None],acc[use]*weight,rcond=None)[0]
        accz.append(c[0]-1j*c[1])
    za=np.array(accz); wa=carrier+slope(np.unwrap(np.angle(za)))
    xa=np.abs(za)/wa**2; ga=-2*slope(np.log(xa))
    acceleration=series(xa,omega_d=wa,gamma=np.maximum(0,ga),mass=np.ones_like(xa))
    # Check the published unit choice against observed log-amplitude decay in
    # the separate source file. Use all positive PFF times up to 3 seconds.
    pt=p_t-p_t[0]; pa=np.interp(centers-release,pt,np.log(p_x)); use=(centers-release)<3
    obs=-slope(pa)[use]; pred=np.interp((centers-release)[use],pt,p_ratio*p_w)
    metrics={"ratio_vs_logdec_rmse_per_s":float(np.sqrt(np.mean((obs-pred)**2))),
             "percent_interpretation_rmse_per_s":float(np.sqrt(np.mean((obs-pred/100)**2))),
             "observed_decay_median_per_s":float(np.median(obs)),
             "author_ratio_pred_median_per_s":float(np.median(pred)),
             "matched_acc_dim":int(acc.size),"location_mm":site_mm,
             "grid_neighbors_mm":[float(xgrid[j-1]),float(xgrid[j])],
             "fixed_carrier_hz":float(carrier/(2*np.pi)),
             "num_windows":len(centers),"window_range_absolute_s":centers[[0,-1]].tolist(),
             "DIC_x_range_m":[float(min(amp)),float(max(amp))],
             "pff_x_range_m":[float(min(p_x)),float(max(p_x))],
             "DIC_freq_hz_range":[float(np.min(omega)/(2*np.pi)),float(np.max(omega)/(2*np.pi))],
             "DIC_relative_mass_range":[float(min(mass)),float(max(mass))],
             "DIC_mass_first_mid_last":mass[[0,len(mass)//2,-1]].tolist(),
             "DIC_gamma_first_mid_last":sloss[[0,len(sloss)//2,-1]].tolist(),
             "DIC_negative_energy_decay_windows":int(sum(sloss<0)),
             "DIC_constant_shape_negative_windows":int(sum(slocal<0)),
             "collocated_PFF_negative_damping_rows":int(sum(p_ratio<0))}
    return {"spatial-energy":dic,"author-PFF":pff,"constant-linear":lin,
            "constant-shape":fixed,"acceleration-only":acceleration},metrics


def predict(law, frequency_hz, acceleration_amplitude):
    hz=np.asarray(frequency_hz,dtype=float);acc=np.asarray(acceleration_amplitude,dtype=float)
    if hz.ndim!=1 or hz.shape!=acc.shape or not np.all(np.isfinite(hz)&np.isfinite(acc)&(hz>0)&(acc>0)):
        raise ValueError("All original rows need a positive finite frequency and amplitude")
    w=2*np.pi*hz;x=acc/w**2; knots=np.asarray(law["x_m"])
    interp=lambda key:np.interp(np.log(x),np.log(knots),law[key])
    wd=interp("omega_d");gamma=interp("gamma");m=interp("mass")
    re=wd**2+(gamma/2)**2-w**2
    im=gamma*w
    magnitude=m*x*np.hypot(re,im)
    phase=np.pi-np.arctan2(im,re)
    folded=np.rad2deg(np.arctan2(np.abs(np.sin(phase)),np.abs(np.cos(phase))))
    norm=np.sqrt(np.mean(magnitude**2))
    if not norm>0:raise ValueError("Predicted force RMS is zero")
    return {"normalized_force":(magnitude/norm).tolist(),"folded_phase_deg":folded.tolist(),
            "predicted_normalizer_arbitrary_units":float(norm),
            "clamped_lower":int(sum(x<knots[0])),"clamped_upper":int(sum(x>knots[-1]))}
