"""Recover known phase/time under each registered detector window; no strain is fetched."""
import json
import math
import numpy as np
from screen import BAND, DF, F, FS, N, bank, quadrature_bank, scores, template, window


def verify(protocol):
    st=1187006834
    idx=1187008882-st
    t=56+.43
    grid=t+np.arange(-8,9)/4096
    full=template(1.187)
    noise=np.ones(BAND.sum())*1e-44
    rows={}
    for det,amp,ph in (("L1",1.,.2),("V1",.4,-.7)):
        w=window(idx,st,det)
        injection=np.fft.irfft(amp*np.exp(1j*ph)*full*np.exp(-2j*np.pi*F*t),n=N)*FS
        data=(np.fft.rfft(w*injection)/FS)[BAND]
        result=bank(data,noise,[1.186,1.187,1.188],grid,w)
        true_snr=math.sqrt(4*DF*np.sum(np.abs(data)**2/noise))
        assert result["chirp_mass"]==1.187 and abs(result["local_time"]-t)<1e-10
        assert abs(result["snr"]/true_snr-1)<1e-9
        if det=="L1":
            assert np.min(w[54*FS:56*FS])==0
        rows[det]=dict(peak_time=result["local_time"],relative_snr_error=result["snr"]/true_snr-1)
    geo=protocol["geometry"]
    M=np.array([[geo["detectors"][s]["plus"],geo["detectors"][s]["cross"]] for s in ("H1","L1","V1")])
    residual=float(np.max(abs(np.array(geo["weights"])@M[1:]-M[0])))
    assert residual<1e-12
    return {"synthetic":rows,"geometry_residual":residual,"measured_files":0}


if __name__=="__main__":
    from pathlib import Path
    print(json.dumps(verify(json.loads((Path(__file__).parent/"protocol.json").read_text())),sort_keys=True))
