"""Compare literal native complex outputs and registered magnitudes using artificial signals."""
import hashlib
import json
import base64
import types
from pathlib import Path

import numpy as np
from scipy import __version__ as scipy_version
from scipy.interpolate import RegularGridInterpolator
from scipy.signal.windows import hann
import fastsc_receiver as implementation

w = np.fromfile('native_w512.bin',dtype='<f8')
assert w.shape == (512,)
print('NATIVE_W512', base64.b64encode(Path('native_w512.bin').read_bytes()).decode(),flush=True)
print('VERSIONS',np.__version__,scipy_version,flush=True)
source=Path('fastsc_receiver.py').read_text()
assert hashlib.sha256(source.encode()).hexdigest()=='12c198c9b5815aa49ab8b984280e3f4e67d1f2fde3d586cf1c039451bbb98345'
old='np.arange(frames) * (cyclic_fs / frames)'
new='(np.arange(frames) / frames) * cyclic_fs'
assert source.count(old)==1
literal=types.ModuleType('literal_native_window_and_axis')
exec(compile(source.replace(old,new),'literal_native_window_and_axis.py','exec'),literal.__dict__)
literal.hann=lambda size,**_:w
results=[]
common = (np.arange(257)[:,None]*125*128 >= np.arange(1281)[None,:]*30) & (np.arange(257)[:,None]*125*128+np.arange(1281)[None,:]*30 <= 32000*128)
common[:,0] = False
order=np.arange(1281)[None,:]/64.
center=np.arange(257)[:,None]*125.
for ix,frames,turns in [(1,5111,15.),(2,5112,25.),(3,4900,24.6)]:
    x=np.fromfile(f'window_input_{ix}.bin',dtype='<f8')
    native=np.fromfile(f'window_S_{ix}.bin',dtype='<f8').reshape(2,-1)
    S=(native[0]+1j*native[1]).reshape(257,-1,order='F')
    axes=np.fromfile(f'window_axes_{ix}.bin',dtype='<f8')
    a,f=axes[:-257],axes[-257:]
    G=np.fromfile(f'window_grid_{ix}.bin',dtype='<f8').reshape(257,1281,order='F')
    for name,runner in [('existing-scipy',implementation),('literal-native-vector-and-axis',literal)]:
        T,al,ff=runner.fast_spectral_correlation(x,64000.,512,640.)
        np.testing.assert_array_equal(ff,f)
        full_shape=T.shape==S.shape
        common_cols=min(len(al),len(a))
        np.testing.assert_allclose(al[:common_cols],a[:common_cols],rtol=3e-15,atol=1e-12)
        P=RegularGridInterpolator((ff,al),abs(T),bounds_error=False,fill_value=0.)((center-order*turns/2,np.broadcast_to(order*turns,G.shape)))
        delta=abs(S[:,:common_cols]-T[:,:common_cols]);gd=abs(P-G)
        c=tuple(int(v) for v in np.unravel_index(delta.argmax(),delta.shape))
        p=tuple(int(v) for v in np.unravel_index(np.argmax(np.where(common,gd,-1.)),gd.shape))
        max_complex=float(delta.max()/abs(S).max());max_grid=float(gd.max()/abs(G).max())
        results.append(dict(mode=name,frames=frames,identical_complex_shape=full_shape,receiver_complex_shape=list(T.shape),native_complex_shape=list(S.shape),native_complex_cells=S.size,all_grid_cells=G.size,common_positive_cells=int(common.sum()),
              max_complex_scaled=max_complex,max_grid_scaled=max_grid,max_common_grid_scaled=float(gd[p]/abs(G[common]).max()),
              complex_worst=list(c),complex_worst_native=[float(S[c].real),float(S[c].imag)],
              complex_worst_receiver=[float(T[c].real),float(T[c].imag)],worst_common=list(p),
              worst_Hz=float(center[p[0],0]),worst_order=float(order[0,p[1]]),worst_common_native=float(G[p]),
              worst_common_receiver=float(P[p]),complex_pass=full_shape and max_complex<1e-10,grid_pass=max_grid<1e-10,
              fft_cyclic_count=len(a),measured_scientific_waveforms=0))
print('FULL_MATRIX',json.dumps({'actual_native_center0':int(w.argmax()),'scipy_center0':int(hann(512,sym=True).argmax()),
      'actual_window_sha256':hashlib.sha256(w.astype('<f8').tobytes()).hexdigest(),'runs':results},sort_keys=True),flush=True)
if not all(row['complex_pass'] and row['grid_pass'] for row in results if row['mode']=='literal-native-vector-and-axis'):
    raise ValueError('Literal native-vector deployment adapter cannot be qualified')
