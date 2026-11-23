"""Authenticate the complete planned measurement and prediction archive before score intake."""
import hashlib
import json
from pathlib import Path

ROLES={'opposed','nearest-other','nearest-same-shell-other','global-average','shell-average',
       'zero-shape','angular-kriging','odd-pair-correction','quarter-turn-sham',
       'author-update-uncorrected','author-update-Q01'}
def sha(b):return hashlib.sha256(b).hexdigest()

def checked(split_path,lock_dir,lock_digest):
    sraw=Path(split_path).read_bytes()
    assert sha(sraw)=='f1234fc1d4720d73a6699d1c70f97c55da34d95c97452709e77b9c33ce861587'
    s=json.loads(sraw)
    root=Path(lock_dir)
    lb=(root/'lock.json').read_bytes()
    assert sha(lb)==lock_digest
    lock=json.loads(lb)
    ids=[p['target'] for p in s['pairs'] if p['group']=='held']
    assert lock['target_ids']==ids and len(set(ids))==98
    assert lock['source_ids']==sorted(int(i) for i,x in s['frames'].items() if x['access']=='development')
    assert lock['split_sha256']==sha(sraw) and lock['tile_receipt_sha256']=='f873b76417be345c8730d42bf8a1ad4df4f028504075c12967a2066c084bc509'
    assert lock['dtype']=='little-endian float32' and lock['matrix_shape']==[98,256,256]
    assert lock['prespecified_primary']=='odd-pair-correction' and lock['target_image_views_or_reads']==0
    assert set(lock['forecast_sha256'])==ROLES and set(lock['per_image_sha256'])==ROLES
    assert len(lock['pairs'])==len(ids) and lock['pairs']==[p for p in s['pairs'] if p['group']=='held']
    assert set(x.name for x in root.iterdir())=={'lock.json','source-common.f64le','empirical-weights.npz'}|{r+'.f32le' for r in ROLES}
    for role in sorted(ROLES):
        h=hashlib.sha256(); members=[]
        with (root/(role+'.f32le')).open('rb') as f:
            for _ in ids:
                b=f.read(262144);assert len(b)==262144
                h.update(b);members.append(sha(b))
            assert not f.read(1)
        assert h.hexdigest()==lock['forecast_sha256'][role] and members==lock['per_image_sha256'][role]
    for name,key in [('source-common.f64le','source_common_sha256'),('empirical-weights.npz','empirical_weights_sha256')]:
        assert sha((root/name).read_bytes())==lock[key]
    return s,lock
