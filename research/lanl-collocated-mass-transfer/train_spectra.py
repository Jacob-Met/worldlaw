"""Trusted extractor discards all response channels outside training states 1, 2 and 10."""
import hashlib
from pathlib import Path

import numpy as np
from scipy.io import loadmat

MAT = "d738160e7d0a2c422a1189e3fe6c47c6e978be068247f55dc5a94ca381773e0f"
FS = 320
WIDTH = 1024
BAND = (np.fft.rfftfreq(WIDTH, 1 / FS) >= 20) & (np.fft.rfftfreq(WIDTH, 1 / FS) <= 140)
FREQ = np.fft.rfftfreq(WIDTH, 1 / FS)[BAND]


def transforms(records):
    blocks = np.lib.stride_tricks.sliding_window_view(records, WIDTH, axis=-1)[..., ::512, :]
    return np.fft.rfft((blocks-blocks.mean(-1, keepdims=True)) * np.hanning(WIDTH), axis=-1)[..., BAND]


def estimate(z):
    f = z[:, 0]
    a = z[:, 1:]
    cross = (a * f[:,None].conj()).sum(axis=(0,2))
    power = (abs(f)**2).sum(axis=(0,1))
    apower=(abs(a)**2).sum(axis=(0,2))
    return cross/power,abs(cross)**2/(power*apower)


def packet(path):
    if hashlib.sha256(path.read_bytes()).hexdigest() != MAT:
        raise ValueError("unexpected MAT source")
    data=loadmat(path)
    labels=data["states"].reshape(-1)
    return {s:np.moveaxis(data["dataset"][:,:,labels==s],(2,1,0),(0,1,2)).astype(float)
            for s in (1,2,10)}


if __name__ == "__main__":
    import json
    raw=packet(Path("official-port-data3SS.mat"))
    z={s:transforms(x) for s,x in raw.items()}
    h={s:estimate(x)[0] for s,x in z.items()}
    co={s:estimate(x)[1] for s,x in z.items()}
    def loss(pred,true):
        return float(np.sqrt(np.mean(abs(pred-true)**2)/np.mean(abs(true)**2)))
    sigmas=(-1,1)
    checks={str(sign):loss(h[1]/(1+sign*1.2*h[1][0]),h[2]) for sign in sigmas}
    crops={str(s):[float(a) for a in np.median(co[s],axis=1)] for s in z}
    scores={str(s):[float(a) for a in np.std(raw[s],axis=(0,2))] for s in z}
    out={"states":list(raw),"input_A_vector_shape":z[1].shape,"no_change_vs_state2":loss(h[1],h[2]),
         "nominal_sigma_vs_state2":checks,"median_training_coherence_each_floor":crops,
         "raw_sd_file_units_force_then_4floors":scores,"input_response_units_contract":"report axes N, m/s^2; MAT no unit fields"}
    sign=min(sigmas,key=lambda t:checks[str(t)])
    pred=h[1]/(1+sign*1.2*h[1][0])
    a,b=np.unravel_index(np.argmax(abs(pred-h[2])),pred.shape)
    out["worst_no_contact_calibration_frequency"]={"output_channel":int(a+2),"frequency_Hz":float(FREQ[b]),
        "pred_RI":[pred[a,b].real,pred[a,b].imag],"target_RI":[h[2][a,b].real,h[2][a,b].imag]}
    out["coherence_lowest_contact_floor_freq"]=list(map(float,np.unravel_index(np.argmin(co[10]),co[10].shape)))
    print(json.dumps(out))
