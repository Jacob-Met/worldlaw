"""Read only run-design metadata from the author's verified 15 archived MAT entries."""
import hashlib
import io
import json
import tarfile
import urllib.request as net
from pathlib import PurePosixPath
from scipy.io import loadmat, whosmat

ALLOWED = ['RunID', 'NISampleRate', 'VNavSampleRate', 'Speed', 'Rider', 'Environment', 'Maneuver', 'Bicycle', 'DateTime', 'corrupt', 'warning']
def main():
    with net.urlopen('https://api.figshare.com/v2/articles/659465/versions/4',timeout=60) as f:
        meta=json.load(f)
    item=next(f for f in meta['files'] if f['id']==1017793)
    with net.urlopen(item.get('downloadUrl') or item['download_url'],timeout=80) as f:
        body=f.read()
    assert len(body)==29445451 and hashlib.sha256(body).hexdigest()=='ed27649e51a4132fc24a799bef2d3e0cec6a5b15980b17e19fb392a126da0a51'
    rows=[]
    with tarfile.open(fileobj=io.BytesIO(body),mode='r|gz') as archive:
        for entry in archive:
            if not entry.isfile(): continue
            raw=archive.extractfile(entry).read()
            names={name: shape for name,shape,dt in whosmat(io.BytesIO(raw))}
            parsed=loadmat(io.BytesIO(raw),variable_names=ALLOWED,squeeze_me=True)
            row={k:(v.item() if hasattr(v,'item') else v) for k,v in parsed.items() if k in ALLOWED}
            assert int(PurePosixPath(entry.name).stem)==row['RunID']
            row['date']=str(row.pop('DateTime')).split(' ')[0]
            row['sha256']=hashlib.sha256(raw).hexdigest()
            row['sample_count']=int(names['PullForce'][0])
            assert names['RollAngle']==names['SteerAngle']==names['PullForce']
            rows.append(row)
    pseudonyms={r:'rider-'+str(i+1) for i,r in enumerate(sorted({q['Rider'] for q in rows}))}
    for q in rows:q['Rider']=pseudonyms[q['Rider']]
    print('author subset design',json.dumps(rows,sort_keys=True))
    print('kinematic arrays, pull arrays, archived fitted coefficients opened: 0')
if __name__=='__main__':main()
