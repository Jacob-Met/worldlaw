"""Frozen ParWH clock comparison using the released Flax checkpoint."""
import ast
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
import urllib.request
import zipfile

os.environ.update(OPENBLAS_NUM_THREADS='1', OMP_NUM_THREADS='1', JAX_PLATFORMS='cpu')
if hasattr(os, 'sched_getaffinity'):
    os.sched_setaffinity(0, sorted(os.sched_getaffinity(0))[:2])
import numpy as np
from scipy.io import loadmat
from scipy.special import expit

N = 16384
PIN = 'd9c4972f6bd59cfdde23a014bc57579e2af957aa'
ARCHIVE = '9d01efe9264a921f83b326ee72fdd1ba0e87063cb67265b750efb8e04a4b385d'
WEIGHTS = 'e440080cdf81a63556b6f4b9bc06610c5f8a19544b12fdef9144d3f2b44ad8b8'
MODELS = 'afd90670c2533b5970c7943c2c7b031a146a6740'
HANK = '48f3b019c8bd14f321d36c7af3aa826da6934f27'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source(root, name, blob):
    path = root / ('upstream-' + name.replace('/', '-'))
    if not path.exists():
        url = f'https://raw.githubusercontent.com/MDCHAMP/nonlinear_baselines/{PIN}/{name}'
        with urllib.request.urlopen(url, timeout=45) as stream:
            data = stream.read()
        assert hashlib.sha1(b'blob ' + str(len(data)).encode() + bytes([0]) + data).hexdigest() == blob
        path.write_bytes(data)
    data = path.read_bytes()
    assert hashlib.sha1(b'blob ' + str(len(data)).encode() + bytes([0]) + data).hexdigest() == blob
    return data.decode()


def variables(root, names):
    data = (root / 'ParWHFiles.zip').read_bytes()
    assert sha(data) == ARCHIVE
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        raw = archive.read('ParWHFiles/ParWHData.mat')
    values = loadmat(io.BytesIO(raw), variable_names=names)
    assert set(k for k in values if not k.startswith('__')) == set(names)
    return values


def native(root):
    import jax
    jax.config.update('jax_enable_x64', True)
    import jax.numpy as jnp
    from flax import linen as nn
    env = {'np': np, 'nn': nn, 'jnp': jnp, 'RNNCell': nn.SimpleCell}
    for filename, blob, selected in [('src/hank.py', HANK, ['get_lags','hank','NARXify']), ('models.py', MODELS, ['RNN','multi_predict_NN'])]:
        tree = ast.parse(source(root, filename, blob))
        tree.body = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in selected]
        assert [node.name for node in tree.body] == selected
        exec(compile(tree, filename, 'exec'), env)
    weights = (root / 'gru-numeric-weights.npz').read_bytes()
    assert sha(weights) == WEIGHTS
    with np.load(io.BytesIO(weights)) as archive:
        numeric = {k: archive[k] for k in archive if k.startswith('params.')}
    theta = {}
    for name, val in numeric.items():
        nested = theta
        keys = name.split('.')
        for key in keys[:-1]:
            nested = nested.setdefault(key, {})
        nested[keys[-1]] = jnp.asarray(val)
    model = env['RNN'](nn.GRUCell)(8)
    def run(u):
        y_null = np.zeros_like(u)
        pred = env['multi_predict_NN']([(u, y_null)], (8, 0), model, theta)[0]
        preds = np.asarray(pred).reshape(-1)
        assert preds.size == len(u)-7 and np.isfinite(preds).all()
        return np.r_[np.full(7,np.nan), preds]
    return run, numeric


def manual(u, weights):
    x = np.lib.stride_tricks.sliding_window_view(u, 8)[:, ::-1].astype(np.float32)
    def item(gate, key):
        return weights[f'params.GRUCell_0.{gate}.{key}']
    ir, iz, candidate = (x @ item(g, 'kernel') + item(g, 'bias') for g in ['ir', 'iz', 'in'])
    hr, hz, hn = (item(g, 'kernel') for g in ['hr','hz','hn'])
    h = np.zeros(8, dtype=np.float32)
    hidden = np.empty_like(x)
    for t in range(len(x)):
        r = expit(ir[t] + h @ hr)
        z = expit(iz[t] + h @ hz)
        n = np.tanh(candidate[t] + r * (h @ hn + item('hn', 'bias')))
        h = (1-z)*n + z*h
        hidden[t] = h
    y = hidden @ weights['params.Dense_0.kernel'] + weights['params.Dense_0.bias']
    return np.r_[np.full(7, np.nan), y.ravel()]


def scaler(training):
    half = training.reshape(2*N, 20, 5)[:N]
    scale = 2.0 / (half.max() - half.min())
    return float(scale), float(-1 - half.min()*scale)


def chronological(data):
    return data.swapaxes(0,1).reshape(2*N, *data.shape[2:])


def savejson(path, obj):
    with path.open('x') as f:
        json.dump(obj, f, indent=2, allow_nan=False)
    print(path.name, sha(path.read_bytes()), flush=True)


def qualify(root):
    import jax, flax
    d = variables(root, ['uEst','yEst'])
    us,uo = scaler(d['uEst']); ys,yo = scaler(d['yEst'])
    run, weights = native(root)
    rows=[]
    for amp, phase, clock in [(0,16,'literal'),(4,19,'physical')]:
        arr = chronological(d['uEst']) if clock=='physical' else d['uEst'].reshape(2*N,20,5)
        u = arr[:4096,phase,amp]*us + uo
        a,b = run(u),manual(u,weights)
        err = np.abs(a[7:]-b[7:]); i=int(err.argmax())
        rows.append(dict(amp=amp,phase=phase,clock=clock,samples=len(err),max_abs=float(err[i]),rms=float(np.sqrt(np.mean(err**2))),worst_row=i+7,flax=float(a[i+7]),numpy=float(b[i+7])))
    passed = max(r['max_abs'] for r in rows)<=5e-5
    savejson(root/'qualification.json', dict(passed=passed, rows=rows, scaler=[us,uo,ys,yo],jax=jax.__version__,flax=flax.__version__,numpy=np.__version__, device=str(jax.devices()), arrays_opened=['uEst','yEst']))
    print('QUAL', passed, rows, flush=True)
    assert passed


def windows(u):
    return np.ascontiguousarray(np.lib.stride_tricks.sliding_window_view(u,32)[:,::-1])


def fir_predict(u, coefficients):
    return np.r_[np.full(31,np.nan), windows(u) @ coefficients[:32] + coefficients[32]]


def fit_controls(root):
    d = variables(root, ['uEst','yEst'])
    U,Y=d['uEst'],d['yEst']
    u=U[:,:,:16].ravel(); y=Y[:,:,:16].ravel()
    m=float((u-u.mean()) @ (y-y.mean()) / ((u-u.mean()) @ (u-u.mean())))
    point=np.array([m, y.mean()-m*u.mean()]); co={'point':point}; rows=[]
    for clock, tf in [('physical', chronological),('literal', lambda a:a.reshape(2*N,20,5))]:
        us,ys=tf(U), tf(Y)
        for amp in range(5):
            gram=np.zeros((33,33)); rhs=np.zeros(33)
            for phase in range(16):
                H=windows(us[:,phase,amp]); targets=ys[31:,phase,amp]
                gram[:32,:32]+=H.T @ H; gram[:32,32]+=H.sum(axis=0)
                gram[32,32]+=len(H); rhs[:32]+=H.T @ targets; rhs[32]+=targets.sum()
            gram[32,:32]=gram[:32,32]; coeff=np.linalg.solve(gram,rhs); co[f'{clock}_{amp}']=coeff
            for phase in range(16,20):
                u=us[:,phase,amp]; y=ys[:,phase,amp]; f=fir_predict(u,coeff); resid=(f[50:]-y[50:]); idx=50+int(np.abs(resid).argmax())
                rows.append(dict(clock=clock, amp=amp,phase=phase,fir_mV=float(np.sqrt(np.mean(resid**2))*1000),point_mV=float(np.sqrt(np.mean((point[0]*u[50:]+point[1]-y[50:])**2))*1000),condition=float(np.linalg.cond(gram)),worst_row=idx,truth_V=float(y[idx]),prediction_V=float(f[idx])))
    with (root/'phase-control-coefficients.npz').open('xb') as f: np.savez(f, **co)
    savejson(root/'phase-control-development.json', dict(training=list(range(16)),evaluation=list(range(16,20)),checkpoint_exposed_to_all_estimation_phases=True,roles=rows,coefficient_sha=sha((root/'phase-control-coefficients.npz').read_bytes())))
    print('MAX_DEVELOPMENT', max(rows,key=lambda z:z['fir_mV']))


def predict(root):
    qualification=json.loads((root/'qualification.json').read_text()); assert qualification['passed']
    co_raw=(root/'phase-control-coefficients.npz').read_bytes()
    controls=json.loads((root/'phase-control-development.json').read_text())
    assert sha(co_raw)==controls['coefficient_sha']
    co=np.load(io.BytesIO(co_raw)); us,uo,ys,yo=qualification['scaler']
    # MAT uses a 3-D [sample,period,amp] validation array. Accommodate its singleton phase axis if present.
    d=variables(root,['uVal'])['uVal']; assert d.size==2*N*5 and d.shape[:2]==(N,2) and d.shape[-1]==5
    d=d.reshape(N,2,5); phys=chronological(d); lit=d.reshape(2*N,5)
    run,_=native(root); out={}; timing={}
    def original(inputs):
        return (run(inputs*us+uo)-yo)/ys
    for a in range(5):
        p=phys[:,a]; l=lit[:,a]; start=time.monotonic()
        out[f'literal_{a}']=original(l)
        out[f'direct_{a}']=original(p)
        repeated=np.repeat(p,2); previous=np.r_[p[0],p[:-1]]
        wrong=np.column_stack([previous,p]).ravel()
        out[f'repeat_{a}']=original(repeated).reshape(2*N,2).mean(axis=1)
        out[f'wrong_{a}']=original(wrong).reshape(2*N,2).mean(axis=1)
        out[f'point_{a}']=p*co['point'][0]+co['point'][1]
        out[f'fir_physical_{a}']=fir_predict(p,co[f'physical_{a}'])
        out[f'fir_literal_{a}']=fir_predict(l,co[f'literal_{a}'])
        timing[a]=time.monotonic()-start
        for role in ('literal','direct','repeat','wrong','point','fir_physical','fir_literal'):
            v=out[f'{role}_{a}']; assert v.shape==(2*N,) and np.isfinite(v[50:]).all()
        print('FORECAST_AMPLITUDE_LOCKED',a, flush=True)
    with (root/'official-input-only-predictions.npz').open('xb') as fp: np.savez_compressed(fp,**out)
    savejson(root/'prediction-lock.json',dict(weights=WEIGHTS,archive=ARCHIVE,qualified=sha((root/'qualification.json').read_bytes()),phase_fit=sha(co_raw),predictions=sha((root/'official-input-only-predictions.npz').read_bytes()),input_sha=sha(d.tobytes(order='C')),arrays_opened=['uVal'],prediction_bytes=(root/'official-input-only-predictions.npz').stat().st_size,rows_per_role=2*N,elapsed_seconds_by_amplitude=timing,array_hashes={k:sha(v.tobytes()) for k,v in out.items()}))
    print('FORECAST_ARCHIVE',sha((root/'official-input-only-predictions.npz').read_bytes()))


if __name__ == '__main__':
    root=Path(sys.argv[1]); mode=sys.argv[2]
    {'qualify':qualify, 'controls':fit_controls,'predict':predict}[mode](root)
