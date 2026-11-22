"""Localize the frozen CPU-versus-archived forecast gate on original coordinates."""
import json
from pathlib import Path
import sys
import zipfile
import numpy as np
from score import get,vector


def main(root, roster):
    spec=json.loads(roster.read_text()); archive=root/'historic-git-blobs'; info={}
    with zipfile.ZipFile(root/'final-competition-share.zip') as z:
        for m,n in zip('ABCDE',[7651,3172,5357,7299,3738]):
            role=np.load(root/f'forecast-{m}.npz',allow_pickle=False)
            def field(key):
                with z.open(f'Testing/Material {m}/{key}.csv') as f:
                    return np.loadtxt(f,delimiter=',')
            hz,temp=field('Frequency'),field('Temperature')
            truth=next(q for q in spec['truth'] if q['letter']==m)
            ys=vector(get(truth,spec['revision'],archive),truth['path'],n)
            info[m]={}
            for team,kind in [('Paderborn','winner_original'),('Sydney','sydney_original')]:
                rec=next(q for q in spec['teams'][team] if q['letter']==m)
                hist=vector(get(rec,spec['revision'],archive),rec['path'],n)
                p=role[kind].reshape(-1).astype(np.float64)
                rel=np.abs(p-hist)/np.abs(hist)
                i=int(rel.argmax())
                info[m][team]=dict(archived_git_blob=rec['sha'],i=i,f_Hz=float(hz[i]),T_C=float(temp[i]),
                    truth_Wm3=float(ys[i]),archive_Wm3=float(hist[i]),cpu_Wm3=float(p[i]),
                    max_relative_delta=float(rel[i]),count_over_point_two_percent=int(sum(rel>.002)))
            r=role['origin_voltage']
            dist=np.minimum(r,1024-r)
            info[m]['phase']={'native_zero_anchor_count':int(sum(r==0)),'all_n':int(len(r)),
                              'median_unsigned_distance_samples':float(np.median(dist)),
                              'max_unsigned_distance_samples':int(max(dist))}
            original=role['winner_original'].reshape(-1).astype(float)
            anchored=role['winner_voltage'].reshape(-1).astype(float)
            diff=(abs(anchored-ys)-abs(original-ys))/ys*100.
            i=int(diff.argmax())
            info[m]['worst_canonical_regression']={'i':i,'error_increase_pp':float(diff[i]),
                'truth_Wm3':float(ys[i]),'original_Wm3':float(original[i]),'candidate_Wm3':float(anchored[i]),
                'f_Hz':float(hz[i]),'T_C':float(temp[i]),'candidate_anchor':int(r[i])}
    out=root/'archive-parity.json'
    with out.open('x') as f:json.dump(info,f,indent=2,allow_nan=False)
    print('PARITY_RAW_D',info['D'])


if __name__=='__main__':main(*(Path(v) for v in sys.argv[1:]))
