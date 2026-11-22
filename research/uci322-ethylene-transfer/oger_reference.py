"""Use the pre-publication Oger initialize and execute methods with their documented NumPy binding.

The application-specific 2015 supplementary script and random draw were unavailable.
"""
import hashlib
import inspect
from pathlib import Path
import textwrap
from types import SimpleNamespace
from urllib.request import urlopen
import numpy as np


REVISION = '7bb8439a449f9a04fc31ae6392966ff5c16f83fc'
SOURCES = {'src/Oger/nodes/reservoir_nodes.py':'3f65acb1e906b44a9af6f68feec16604226da5c4',
           'src/Oger/utils/utility_functions.py':'daa7bc65da62121c08122a2dca558958f7d1e582'}


def upstream(path, name):
    raw = path.read_bytes() if path.exists() else None
    if raw is None:
        with urlopen('https://raw.githubusercontent.com/x75/Oger/'+REVISION+'/'+name,timeout=45) as f:
            raw=f.read()
    digest=hashlib.sha1(b'blob '+str(len(raw)).encode()+bytes([0])+raw).hexdigest()
    assert digest==SOURCES[name], (name,digest)
    if not path.exists():path.write_bytes(raw)
    return raw.decode('utf-8')


def method(source, name, indent):
    lines=source.splitlines(keepends=True)
    start=next(i for i,line in enumerate(lines) if line.startswith(' '*indent+'def '+name+'('))
    end=start+1
    while end<len(lines):
        body=lines[end]
        if body.strip() and not body.lstrip().startswith('#') and len(body)-len(body.lstrip())<=indent:
            break
        end+=1
    return textwrap.dedent(''.join(lines[start:end]))


def node(root):
    src=upstream(root/'oger-reservoir_nodes.py','src/Oger/nodes/reservoir_nodes.py')
    util=upstream(root/'oger-utility_functions.py','src/Oger/utils/utility_functions.py')
    # Bind the exact backend operations that the original methods invoke.
    mdp=SimpleNamespace(numx=np,NodeException=RuntimeError)
    ns={'mdp':mdp,'inspect':inspect,'np':np}
    exec(method(util,'get_spectral_radius',0),ns)
    ns['Oger']=SimpleNamespace(utils=SimpleNamespace(get_spectral_radius=ns['get_spectral_radius']))
    methods={}
    for name in ('initialize','_execute','_post_update_hook'):
        exec(method(src,name,4),ns)
        methods[name]=ns[name]
    instance=type('SourceOgerReservoir',(),methods)()
    instance.input_dim=16;instance.output_dim=100
    instance.spectral_radius=.1;instance.input_scaling=1e-5;instance.bias_scaling=0.
    instance.w_in_initial=instance.w_initial=instance.w_bias_initial=None
    instance.reset_states=False;instance.nonlin_func=np.tanh
    # The historical application does not supply an original random-seed receipt.
    np.random.seed(1511)
    instance.initialize()
    return instance


def qualify(root):
    rng=np.random.RandomState(2023)
    x=rng.normal(1000,450,size=(4096,16))
    inst=node(root);one=inst._execute(x).copy()
    inst=node(root);parts=np.concatenate([inst._execute(piece).copy() for piece in np.array_split(x,7)])
    assert np.array_equal(one,parts)
    weights=hashlib.sha256(inst.w.tobytes()+inst.w_in.tobytes()+inst.w_bias.tobytes()).hexdigest()
    print('SOURCE_OGER',REVISION,'ARRAY_WINDOW_EQ',len(x),'WEIGHT_SHA',weights,flush=True)
    return weights
