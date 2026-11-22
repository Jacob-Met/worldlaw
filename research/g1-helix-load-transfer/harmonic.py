"""Extract measured cyclic pitch and load harmonics using the common WT1 clock."""
import numpy as np
from scipy.optimize import minimize_scalar
from response import pack


def fourier(t, values, freq, lo=5., hi=55.):
    keep = (t >= lo) & (t < hi)
    ts = t[keep]
    angle = 2*np.pi*freq*ts
    basis = np.column_stack([np.ones_like(ts), (ts-(lo+hi)/2)/(hi-lo), np.cos(angle), np.sin(angle)])
    coef = np.linalg.lstsq(basis, values[keep], rcond=None)[0]
    return coef[2] - 1j*coef[3]


def cyclic(blades, azimuth):
    sign = np.sign(azimuth[-1]-azimuth[0])
    psi = azimuth[:, None] - sign * 2*np.pi/3 * np.arange(3)
    centered = blades - np.mean(blades, axis=1, keepdims=True)
    return (2/3)*np.column_stack([(centered*np.cos(psi)).sum(axis=1), (centered*np.sin(psi)).sum(axis=1)])


def read_inputs(group, t, case):
    angles = np.unwrap(np.deg2rad(group['Azimuth'][:]))
    tp = t[::10]
    measured = np.column_stack([group[f'Pitch/Blade{i}'][:] for i in range(1,4)])
    demanded = np.column_stack([group[f'Pitch/Blade{i}Dem'][:] for i in range(1,4)])
    if angles.shape != t.shape or measured.shape != (len(tp),3) or measured.shape != demanded.shape:
        raise ValueError("Unexpected timing layout")
    if not all(np.isfinite(a).all() for a in (angles, measured, demanded)):
        raise ValueError("Nonfinite pitch or azimuth")
    rotor = (angles[-1]-angles[0])/(2*np.pi*(t[-1]-t[0]))
    u = cyclic(measured, angles[::10])
    demand = cyclic(demanded, angles[::10])
    f0 = abs(rotor) * (.076 if case == 1037 else .075)
    # Find the dominant fixed-frame input oscillation without accessing hub moments.
    low, high = .75*f0, 1.25*f0
    grid = np.arange(low, high, .002)
    if len(grid) < 3:
        raise ValueError("Inadequate angular excitation")
    def power(f):
        return float(np.linalg.norm(fourier(tp,u,f))**2)
    i = int(np.argmax([power(f) for f in grid]))
    if i in (0,len(grid)-1):
        raise ValueError("Input frequency outside preregistered band")
    freq = minimize_scalar(lambda f: -power(f), bounds=(grid[i-1],grid[i+1]), method='bounded',
                           options={'xatol':1e-9}).x
    ph = fourier(tp,u,freq)
    blocks = np.stack([fourier(tp,u,freq,b,b+10) for b in (5,15,25,35,45)])
    # Indexing extremal native fast-clock offsets quantifies the unreported 250-Hz phase origin.
    shift = []
    for offset in range(10):
        delayed = cyclic(measured, angles[offset::10])
        shift.append(pack(fourier(t[offset::10],delayed,freq)))
    return {'case':case,'rotor_mean_signed_hz':float(rotor),'ratio_recorded':.076 if case==1037 else .075,
            'frequency_hz':float(freq),'ratio_measured':float(freq/abs(rotor)), 'u':pack(ph),
            'u_demand':pack(fourier(tp,demand,freq)), 'input_harmonics_five_10s_blocks':pack(blocks),
            'phase_origin_sensitivity_offsets_0_to_3p6_ms':shift,
            'time_origin_s':float(t[0]),'analysis_interval_s':[5,55]}


def read_loads(group,t,freq):
    channels=['FilteredLoads/Hub/NoddingFixed','FilteredLoads/Hub/YawingFixed']
    data=np.column_stack([group[n][:] for n in channels])
    if data.shape!=(len(t),2) or not np.isfinite(data).all():
        raise ValueError("Invalid full fixed-frame moments")
    y=fourier(t,data,freq)
    return {'y':pack(y),'blocks_y':pack(np.stack([fourier(t,data,freq,b,b+10) for b in (5,15,25,35,45)]))}
