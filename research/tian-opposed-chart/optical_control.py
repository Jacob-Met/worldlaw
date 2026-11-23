"""Singleton held-angle forward control using Tian's rank-one object/pupil updates.

The released driver requires sample-specific external functions and background windows.
This explicit center-tile adaptation uses the chart parameters and two fixed background
policies. Its results are tile forecasts, not a reproduction of the article's reconstruction.
"""
import numpy as np


def round_half_away(x):
    return np.sign(x) * np.floor(np.abs(x) + 0.5)


def forward_controls(ids, frame_xy, raw, held):
    size = 256
    dpix = 6.5 / 8.1485
    wavelength = 0.6292
    na = 0.1
    df = 1 / (size * dpix)
    xall = np.asarray([frame_xy[i] for i in range(1, 294)], dtype=np.float64)
    transverse = -4000 * xall / np.sqrt(67500**2 + np.sum((4000 * xall)**2, axis=1))[:, None]
    shifts = round_half_away(transverse / (wavelength * df)).astype(int)
    radius = np.sqrt(np.sum(transverse**2, axis=1))
    bound = (float(radius.max()) + na) / wavelength
    object_size = int(np.ceil((2*round_half_away(2*bound/df))/size))*size
    # SystemSetup assigns its horizontal LED coordinate to sin_thetav (camera row).
    coordinates = np.arange(size) - size//2
    hh, vv = np.meshgrid(coordinates, coordinates)
    support = (hh*hh+vv*vv < (na/(wavelength*df))**2).astype(np.float64)
    order = sorted(range(len(ids)), key=lambda i:(radius[ids[i]-1],ids[i]))
    assert ids[order[0]] == 147
    def region(i):
        center = object_size//2 - shifts[i-1]
        return tuple(slice(c-size//2, c+size//2) for c in center)
    zero = (slice((object_size-size)//2,(object_size+size)//2),)*2
    f = lambda a: np.fft.fftshift(np.fft.fft2(a))
    inv = lambda a: np.fft.ifft2(np.fft.ifftshift(a))
    out = {}; costs = {}
    for role in ('author-update-uncorrected','author-update-Q01'):
        field = np.asarray(raw, dtype=np.float64).reshape(-1,size,size)
        if role.endswith('Q01'):
            pedestal = np.quantile(field, .01, axis=(1,2), method='lower')[:,None,None]
            field = np.maximum(field-pedestal,0)
        amp = np.sqrt(field)
        pupil = support.astype(np.complex128)
        obj = np.zeros((object_size,object_size),dtype=np.complex128)
        obj[zero] = f(amp[order[0]])
        previous, current = np.inf, 50.
        trace=[]
        while abs(previous-current)>1 and len(trace)<10:
            previous, current=current,0.
            for s in order:
                r=region(ids[s]); old=obj[r].copy()
                wave=old*pupil
                image=inv(wave)
                estimate=abs(image)**2
                d = f(amp[s]*np.exp(1j*np.angle(image)))-wave
                pabs=np.abs(pupil); oabs=np.abs(old)
                pm=float(pabs.max()); om=abs(obj[object_size//2,object_size//2])
                if min(pm,om)<=0 or not np.isfinite(pm+om):
                    raise ValueError('degenerate source-bound optical update')
                obj[r]=old+(.1/pm)*pabs*np.conj(pupil)*d/(pabs**2+1)
                pupil += (oabs*np.conj(old))*d/(om*(oabs**2+1000))*support
                current+=np.linalg.norm(field[s]-estimate)
            trace.append(float(current))
            if len(trace)>2 and current>previous:break
        forecasts = []
        for i in held:
            tile=(abs(inv(obj[region(i)]*pupil))**2).ravel()
            tile-=tile.mean()
            norm=np.linalg.norm(tile)
            forecasts.append(tile/norm if norm else np.zeros_like(tile))
        out[role]=np.asarray(forecasts,dtype='<f4')
        costs[role]={'iterations':len(trace),'source_intensity_residual_sum':trace,'tile':size,'object_size':object_size,'array_NA':float(radius.max()),'source_images':len(ids),'hidden_images':len(held)}
    return out,costs
