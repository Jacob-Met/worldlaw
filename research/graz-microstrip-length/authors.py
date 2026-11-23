"""Call each released nominal fit; invert its documented forward measurement map."""
import contextlib
import io
import numpy as np
import skrf as rf
from matrix_paths import from_t
from mTRL import mTRL
from maintained_multiline import multiline


def nw(frequency, s):
    return rf.Network(frequency=rf.Frequency.from_f(frequency,unit='hz'),s=s)


def fit_author(frequency, means, short, current):
    labels=sorted(means)
    args=dict(lines=[nw(frequency,means[l]) for l in labels],
              line_lengths=[l*.0005 for l in labels],reflect=nw(frequency,short),
              reflect_est=-1,reflect_offset=0,ereff_est=2.5-.00001j)
    with contextlib.redirect_stdout(io.StringIO()):
        cal=multiline(**args) if current else mTRL(**args)
        if current:
            cal.run_multiline()
        else:
            cal.run_tug()
    return cal


def embed_and_verify(cal, frequency, length):
    ell=length*.0005
    forward=np.exp(-cal.gamma*ell)
    idealvec=np.zeros((len(frequency),4),complex)
    idealvec[:,0]=forward
    idealvec[:,3]=1/forward
    rawvec=cal.k[:,None]*np.einsum('fij,fj->fi',cal.X,idealvec)
    t=rawvec.reshape(-1,2,2).transpose(0,2,1)
    raw=from_t(t)
    returned=cal.apply_cal(nw(frequency,raw))
    net=returned[0] if isinstance(returned,tuple) else returned
    ideal=np.zeros_like(raw)
    ideal[:,1,0]=ideal[:,0,1]=forward
    err=float(np.max(abs(net.s-ideal)))
    if not np.isfinite(err) or err>1e-8:
        raise ValueError(f'author embedding/actual apply_cal inverse failed: {err}')
    return raw,err
