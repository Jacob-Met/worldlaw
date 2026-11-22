"""Rebuild both native evidence archives from numerical arrays, then recount 33,600 residuals."""
import ast
import hashlib
import io
import json
from pathlib import Path
import struct
import tempfile
import zipfile
from recount import recount

ROOT=Path(__file__).resolve().parent


def sha(b):
    return hashlib.sha256(b).hexdigest()


def numeric_payload(p):
    with p.open('rb') as f:
        assert f.read(8)==b'\x93NUMPY\x01\x00'
        size=struct.unpack('<H',f.read(2))[0]
        meta=ast.literal_eval(f.read(size).decode('latin1').strip())
        assert meta=={'descr':'<f8','fortran_order':False,'shape':(2,14,48,25)}
        nums=f.read();assert len(nums)==2*14*48*25*8;return nums


def packed(entries):
    dest=io.BytesIO()
    with zipfile.ZipFile(dest,'w') as z:
        for name,data in entries:
            info=zipfile.ZipInfo(name,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,data)
    return dest.getvalue()


def build(root):
    files=json.loads((root/'file-digests.json').read_bytes())
    for name,h in files.items():assert sha((root/name).read_bytes())==h,name
    census=json.loads((root/'original-members.json').read_bytes())
    fmanifest=(root/'forecast-manifest.json').read_bytes();m=json.loads(fmanifest)
    data=numeric_payload(root/'forecast-values.npy');offset=0;inner=[]
    for meter in ('stable','early'):
        for role in m['roles']:
            name=f'{meter}/{role}.f64le';b=data[offset:offset+9600];offset+=9600
            assert sha(b)==m['members'][name];inner.append((name,b))
    assert offset==len(data);inner.append(('manifest.json',fmanifest));forecast=packed(inner)
    assert sha(forecast)==census['forecast_sha256']
    observed=(root/'measured-partials.jsonl').read_bytes().splitlines(keepends=True)
    assert len(observed)==48
    outer=[('forecast.zip',forecast),('scores.json',(root/'scores.json').read_bytes())]
    outer.extend((f'observed/{i:02d}.json',v) for i,v in enumerate(observed))
    for meter in ('early','stable'):
        for name in ('metadata.json','singles.npy','training-mixed.npy'):
            outer.append(('source/'+meter+'/'+name,(root/(meter+'-'+name)).read_bytes()))
    assert {n:[len(v),sha(v)] for n,v in outer}==census['members']
    bundle=packed(outer);assert sha(bundle)==census['bundle_sha256']
    return forecast,bundle,census


if __name__=='__main__':
    _,b,c=build(ROOT)
    with tempfile.TemporaryDirectory() as directory:
        p=Path(directory)/'derived.zip';p.write_bytes(b)
        print(json.dumps(recount(p,c['forecast_sha256'],c['bundle_sha256']),sort_keys=True))
