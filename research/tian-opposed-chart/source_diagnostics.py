"""Inspect registered development ROIs only. No fetching or target lookup."""
from array import array
import base64
import hashlib
import json
import math
from pathlib import Path
import sys
import zlib

def main():
    p=Path(sys.argv[1])
    split_bytes=zlib.decompress(base64.b64decode(sys.argv[2],validate=True))
    assert hashlib.sha256(split_bytes).hexdigest()=='f1234fc1d4720d73a6699d1c70f97c55da34d95c97452709e77b9c33ce861587'
    s=json.loads(split_bytes)
    source={int(i) for i,r in s['frames'].items() if r['access']=='development'}
    ids=sorted(source)
    rec=json.loads((p/'receipts.json').read_bytes())
    assert set(map(int,rec))==source
    frame={};info={}
    for i in ids:
        b=(p/f'{i:03}.u16le').read_bytes()
        assert len(b)==131072 and hashlib.sha256(b).hexdigest()==rec[str(i)]['raw_roi_sha256']
        a=array('H');a.frombytes(b)
        if sys.byteorder!='little':a.byteswap()
        n=len(a); mean=sum(a)/n;ss=sum(x*x for x in a)-n*mean**2
        info[i]={'mean_DN':mean,'raw_min':min(a),'raw_max':max(a),'rms_DN':math.sqrt(max(0,ss)/n),'hard_limits':sum(x in (0,65535) for x in a)}
        frame[i]=a
    def error(i,j):
        x,y=frame[i],frame[j];mi=info[i]['mean_DN'];mj=info[j]['mean_DN'];si=info[i]['rms_DN'];sj=info[j]['rms_DN']
        if not (si and sj):return float(bool(si))+float(bool(sj))
        corr=(sum(v*w for v,w in zip(x,y))/len(x)-mi*mj)/(si*sj)
        return max(0,2-2*corr)
    coords={i:tuple(s['frames'][str(i)]['led_xy']) for i in source}
    out=[]
    for pair in s['pairs']:
        if pair['group']!='development':continue
        t=pair['target'];d=pair['donor'];x,y=coords[t];rest=source-{t,d}; candidates=[j for j in rest if sum(z*z for z in coords[j])==x*x+y*y]
        radial=min(candidates,key=lambda j:((coords[j][0]-x)**2+(coords[j][1]-y)**2,j)) if candidates else min(rest)
        nearest=min(rest,key=lambda j:((coords[j][0]-x)**2+(coords[j][1]-y)**2,j))
        out.append({'t':t,'d':d,'r2':x*x+y*y,'radial_donor':radial,'near_donor':nearest,'opposite':error(t,d),'radial':error(t,radial),'nearest':error(t,nearest)})
    worst=max(out,key=lambda r:r['opposite'])
    t,d=worst['t'],worst['d'];a,b=frame[t],frame[d];it,id_=info[t],info[d]
    def v(x,h): return (x-h['mean_DN'])/h['rms_DN'] if h['rms_DN'] else 0.
    pix=max(range(len(a)),key=lambda k:abs(v(a[k],it)-v(b[k],id_)))
    diag={'development_shapes':len(ids),'development_pairs':len(out),'target_access':0,
          'normalized_shape_mean_squares':{name:sum(r[name] for r in out)/len(out) for name in ('opposite','radial','nearest')},
          'raw_RMS_DN_range':[min(z['rms_DN'] for z in info.values()),max(z['rms_DN'] for z in info.values())],
          'rms_at_most_one_DN':sum(z['rms_DN']<=1 for z in info.values()),'constant_count':sum(z['rms_DN']==0 for z in info.values()),
          'stored_endpoints_0_or_65535':sum(z['hard_limits'] for z in info.values()),'worst_pair':worst,'target_raw':it,'donor_raw':id_,
          'worst_pair_pixel':{'row_col_zero_based':[952+pix//256,1152+pix%256],'target':a[pix],'donor':b[pix],'target_z':v(a[pix],it),'donor_z':v(b[pix],id_)},
          'all_development_rows':out,'per_source_frame_info':info}
    raw=(json.dumps(diag,sort_keys=True,separators=(',',':'))+'\n').encode()
    (p/'development-diagnostics.json').write_bytes(raw)
    short={k:w for k,w in diag.items() if k not in ('all_development_rows','per_source_frame_info')}
    try:import numpy;short['numpy_version']=numpy.__version__
    except ImportError:short['numpy_version']=None
    print(json.dumps(short,sort_keys=True));print('complete_development_report',len(raw),hashlib.sha256(raw).hexdigest())
if __name__=='__main__':main()
