"""Source-only GW170817 timing and chirp coherence preflight."""
import hashlib
import json
import math
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

import h5py
import lal
import lalsimulation as ls
import numpy as np
from scipy.signal import welch
from scipy.signal.windows import tukey


FS = 4096
N = 64 * FS
DF = 1 / 64
F = np.fft.rfftfreq(N, 1 / FS)
BAND = (F >= 35) & (F <= 100) & ((F < 59) | (F > 61))
FB = F[BAND]
GPS = 1187008882.43


def acquire(product, folder):
    key = product["detector"]
    assert key in ("L1","V1") and key+"_" in product["url"]
    assert product["format"]=="hdf5" and product["sampling_rate"]==FS and product["duration"]==4096
    assert "/GW170817/v1/" in product["url"] and "CLN" not in product["url"]
    path=folder/(key+".hdf5")
    digest=hashlib.sha256()
    with urlopen(Request(product["url"],headers={"User-Agent":"Optical-position network geometry research"}),timeout=60) as inp,path.open("xb") as out:
        for block in iter(lambda:inp.read(1048576),b""):
            digest.update(block)
            out.write(block)
    with h5py.File(path) as stream:
        start=int(stream["meta/GPSstart"][()])
        assert start==product["GPSstart"] and int(stream["meta/Duration"][()])==4096
        ident=stream["meta/Detector"][()]
        if isinstance(ident,bytes):
            ident=ident.decode()
        assert ident==key
        ds=stream["strain/Strain"]
        assert len(ds)==4096*FS and float(ds.attrs["Xspacing"])==1/FS
        arr=ds[:int((GPS-start+9)*FS)]
        meta=dict(sha256=digest.hexdigest(),bytes=path.stat().st_size,dtype=str(arr.dtype),dataset=ds.name,detector=key,gps_start=start)
    assert np.isfinite(arr).all()
    return arr,meta


def psd(data):
    f,den=welch(data[:600*FS],fs=FS,window="hann",nperseg=8*FS,noverlap=4*FS,detrend=False,scaling="density",average="median")
    values=np.interp(FB,f,den)
    assert np.all(np.isfinite(values)) and np.all(values>0)
    return values


def window(center, start, detector):
    w = tukey(N,alpha=2/64)
    if detector=="L1":
        delta=np.abs((start+int(center)-56-1187008881)+np.arange(N)/FS-.389)
        w *= (1-np.cos(np.pi*np.clip((delta-.1)/.5,0,1)))/2
    return w


def band_data(data, center, w):
    first=int(center)-56
    cut=data[first*FS:(first+64)*FS]
    assert len(cut)==N
    return (np.fft.rfft(cut*w)/FS)[BAND]


def template(chirp):
    m=chirp*2**.2*lal.MSUN_SI
    hp,_=ls.SimInspiralChooseFDWaveform(m,m,0,0,0,0,0,0,1e6*lal.PC_SI,0,0,0,0,0,DF,35.,100.,35.,lal.CreateDict(),ls.TaylorF2)
    full=np.zeros(len(F),dtype=complex)
    full[:len(hp.data.data)]=hp.data.data
    return full


def quadrature_bank(h, times, w, noise):
    # Every candidate and both real phase quadratures see exactly the same native time window as the data.
    ref=h*np.exp(-2j*np.pi*F*times[0])
    base=np.fft.irfft(ref,n=N)*FS
    ninety=np.fft.irfft(1j*ref,n=N)*FS
    for time in times:
        off=(time-times[0])*FS
        assert abs(off-round(off))<1e-6
        basis=np.stack([(np.fft.rfft(w*np.roll(v,round(off)))/FS)[BAND] for v in (base,ninety)])
        gram=4*DF*((basis/noise)@basis.conj().T).real
        assert np.linalg.eigvalsh(gram).min()>0
        yield basis,gram


def scores(spectrum, forms, den):
    values=[]
    for basis,gram in forms:
        data_vec=4*DF*((basis.conj()/den)@spectrum).real
        # In whitened quadrature coordinates, the Euclidean norm equals the free-phase matched SNR.
        z=np.linalg.solve(np.linalg.cholesky(gram),data_vec)
        values.append(complex(z[0],z[1]))
    return np.array(values)


def bank(spec, noise, masses, times, w):
    best=None
    for mass in masses:
        z=scores(spec,quadrature_bank(template(mass),times,w,noise),noise)
        i=int(np.argmax(abs(z)))
        row=dict(chirp_mass=float(mass),local_time=float(times[i]),snr=float(abs(z[i])),re=float(z[i].real),im=float(z[i].imag))
        if best is None or row["snr"]>best["snr"]:
            best=row
    return best


def study(protocol, directory):
    sources = {}
    metadata = {}
    for record in protocol["catalog"]["selected"]:
        key = record["detector"]
        if key in ("L1","V1"):
            sources[key],metadata[key]=acquire(record,directory)
    assert set(sources)=={"L1","V1"}
    start=metadata["L1"]["gps_start"]
    assert start==metadata["V1"]["gps_start"]
    center=math.floor(GPS)-start
    relative=56+(GPS-math.floor(GPS))
    noise={s:psd(v) for s,v in sources.items()}
    windows={s:window(center,start,s) for s in sources}
    signal={s:band_data(v,center,windows[s]) for s,v in sources.items()}
    coarse=bank(signal["L1"],noise["L1"],np.arange(1100,1301)/1000,relative+np.arange(-25,26)/512,windows["L1"])
    m0=round(coarse["chirp_mass"]*10000)
    fine=bank(signal["L1"],noise["L1"],np.arange(m0-10,m0+11)/10000,coarse["local_time"]+np.arange(-12,13)/4096,windows["L1"])
    det=protocol["geometry"]["detectors"]
    delay=det["V1"]["arrival_s"]-det["L1"]["arrival_s"]
    middle=fine["local_time"]+delay
    times=middle+np.arange(-4,5)/4096
    
    h=template(fine["chirp_mass"])
    forms=list(quadrature_bank(h,times,windows["V1"],noise["V1"]))
    def measure(spectrum):
        z=scores(spectrum,forms,noise["V1"])
        i=int(np.argmax(abs(z)))
        return dict(snr=float(abs(z[i])),central_snr=float(abs(z[4])),best_offset_s=float(times[i]-middle),
                    quadratures=[[float(k.real),float(k.imag)] for k in z])
    v_event=measure(signal["V1"])
    background=[measure(band_data(sources["V1"],680+64*j,windows["V1"])) for j in range(18)]
    weights=np.array(protocol["geometry"]["weights"])
    ratio=noise["V1"]/noise["L1"]
    transfer=np.sqrt(weights[0]**2+weights[1]**2*ratio)
    H,L,V=[np.array([det[s][k] for k in ("plus","cross")]) for s in ("H1","L1","V1")]
    simple=[float(H@d/(d@d)) for d in (L,V)]
    largest=max(x["snr"] for x in background)
    gates=dict(livingston_reference=fine["snr"]>=8,virgo_response=v_event["snr"]>=5,
               exceeds_all_18=v_event["snr"]>largest)
    i=int(transfer.argmax())
    return dict(source_products=metadata,source_bins=len(FB),coarse=coarse,fine=fine,
                source_templates_evaluated=222,virgo=v_event,background=background,background_max=largest,
                gates=gates,source_gate=all(gates.values()),relative_arrival_V_minus_L_s=delay,
                source_noise_transfer_amplitude_relative_to_L=dict(minimum=float(transfer.min()),median=float(np.median(transfer)),
                maximum=float(transfer[i]),worst_hz=float(FB[i]),source_PSD_V_over_L=float(ratio[i])),
                minimum_norm_L_only_and_V_only=simple,Hanford_files_opened=0,posterior_files_opened=0)


if __name__=="__main__":
    with tempfile.TemporaryDirectory() as tmp:
        print(json.dumps(study(json.loads((Path(__file__).parent/"protocol.json").read_text()),Path(tmp)),sort_keys=True))
