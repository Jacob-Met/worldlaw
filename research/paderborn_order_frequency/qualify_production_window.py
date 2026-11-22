"""Qualify the frozen production Fast-SC and physical surface entry using fresh native fixtures."""
import hashlib
import json
from pathlib import Path
import numpy as np

from fastsc_receiver import fast_spectral_correlation, native_window512
from surface import COMMON, FREQ, ORDER, surface

source=Path(__file__).parent
protocol=json.loads((source/'protocol.json').read_text())
if hashlib.sha256((source/'protocol.json').read_bytes()).hexdigest()!='86a79d999e515483f67aa28cc5f277d2d6c009f6039a87ec9cf6dfddfa2fefd8':
    raise ValueError('Wrong production-source protocol')
for name,dig in protocol['source_hashes'].items():
    if hashlib.sha256((source/name).read_bytes()).hexdigest()!=dig:
        raise ValueError('Wrong production dependency '+name)
if Path('native_w512.bin').read_bytes()!=native_window512().tobytes():
    raise ValueError('Fresh native GNU Octave window differs')
results=[]
for ix,frames,turns in [(1,5111,15.),(2,5112,25.),(3,4900,24.6)]:
    refs={k:Path(f'window_{k}_{ix}.bin') for k in ('input','S','axes','grid')}
    source_hashes={k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in refs.items()}
    x=np.fromfile(refs['input'],dtype='<f8')
    split=np.fromfile(refs['S'],dtype='<f8').reshape(2,-1)
    native=(split[0]+1j*split[1]).reshape(257,-1,order='F')
    axes=np.fromfile(refs['axes'],dtype='<f8');alpha,f=axes[:-257],axes[-257:]
    grid=np.fromfile(refs['grid'],dtype='<f8').reshape(257,1281,order='F')
    actual,cyclic,carrier=fast_spectral_correlation(x,64000.,512,640.)
    np.testing.assert_allclose(cyclic,alpha,rtol=3e-15,atol=1e-12)
    if frames%2==0 and not (cyclic[-1]==alpha[-1]==640.):raise ValueError('Lost native Nyquist endpoint')
    np.testing.assert_array_equal(carrier,f)
    if native.shape!=actual.shape:raise ValueError('Output shape mismatch')
    Q,psd,speed=surface(x,np.full(16000,turns*60))
    np.testing.assert_allclose(speed,turns,atol=3e-14,rtol=0)
    complex_error=np.abs(native-actual);grid_error=np.abs(grid-Q)
    c=np.unravel_index(complex_error.argmax(),complex_error.shape)
    p=np.unravel_index(np.argmax(np.where(COMMON,grid_error,-1.)),grid.shape)
    ec=float(complex_error.max()/abs(native).max())
    eg=float(grid_error.max()/abs(grid).max())
    ep=float(abs(psd-native[:,0].real).max()/abs(native[:,0]).max())
    if max(ec,eg,ep)>=1e-10: raise ValueError(f'Production receiver disagreement: {frames} {ec} {eg} {ep}')
    results.append({'frames':frames,'rotation_hz':speed,'complex_shape':list(actual.shape),
                    'all_complex_cells':actual.size,'all_grid_cells':Q.size,'common_positive_cells':int(COMMON.sum()),
                    'max_complex_relative_to_peak':ec,'max_grid_relative_to_peak':eg,'max_dc_relative_to_peak':ep,
                    'complex_worst':[int(k) for k in c],'common_worst':[int(k) for k in p],
                    'common_worst_native':float(grid[p]),'common_worst_production':float(Q[p]),
                    'native_source_sha256':source_hashes})
print('PRODUCTION_GATE',json.dumps({'protocol_sha256':'86a79d999e515483f67aa28cc5f277d2d6c009f6039a87ec9cf6dfddfa2fefd8',
      'runs':results,'physical_measurements_opened':0},sort_keys=True),flush=True)
