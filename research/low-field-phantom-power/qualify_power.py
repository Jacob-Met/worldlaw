"""Assess whether air measurements support a common processed-power offset."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import zlib
import numpy as np

from source_mat_headers import tag

HIGH = np.deg2rad([5.4772,9.6549,17.019,30.])
DTYPES = {1:'i1', 2:'u1', 3:'<i2', 4:'<u2', 5:'<i4', 6:'<u4', 7:'<f4', 9:'<f8', 12:'<i8', 13:'<u8'}


def selected_inputs(path, expected):
    """Numerical projection admits only D[:,:,:,3:7] and B1map, never the low three D spans."""
    source = path.read_bytes()
    if hashlib.sha256(source).hexdigest()!=expected:
        raise ValueError('Original MAT SHA mismatch')
    if source[126:128] != b'IM':
        raise ValueError('Unexpected MAT header')
    numerical = {}
    pos=128
    while pos<len(source) and len(numerical)<2:
        kind,n,start,end=tag(source,pos)
        if kind==15:
            raw=zlib.decompress(memoryview(source)[start:start+n]);pos=start+n; block=0
        elif kind==14:
            raw=source;block=pos;pos=end
        else:
            raise ValueError('Unexpected MAT outer record')
        _,_,base,_=tag(raw,block)
        _,_,q,k=tag(raw,base)
        flags=struct.unpack_from('<I',raw,q)[0]
        _,n,q,k=tag(raw,k)
        dims=tuple(struct.unpack_from('<'+'i'*(n//4),raw,q))
        _,n,q,k=tag(raw,k)
        name=bytes(raw[q:q+n]).decode()
        if name not in ('D','B1map'):
            continue
        if flags&0x800 or flags&255 not in (6,7):
            raise ValueError('Complex or unsupported output class')
        t,n,q,k=tag(raw,k)
        dtype=np.dtype(DTYPES[t]);v=128*128*56
        if name=='D':
            assert dims==(128,128,56,7) and n==7*v*dtype.itemsize
            start_element=3*v;shape=(128,128,56,4)
        else:
            assert dims==(128,128,56) and n==v*dtype.itemsize
            start_element=0;shape=dims
        numerical[name]=np.frombuffer(raw,dtype=dtype,count=int(np.prod(shape)),offset=q+start_element*dtype.itemsize).reshape(shape,order='F').astype(np.float64,copy=True)
    if set(numerical)!={'D','B1map'}:
        raise ValueError('Missing required inputs')
    return numerical['D'], numerical['B1map']


def box_powers(images,boxes):
    blocks=np.concatenate([images[a:a+8,b:b+8,8:48,:].reshape(-1,4) for a,b in boxes])
    return np.mean(np.square(blocks),axis=0),float(np.mean(blocks!=0))


def evaluate(path, item):
    high,b1=selected_inputs(path,item['sha256'])
    box=np.s_[16:112,16:112,8:48]
    scale=float(np.quantile(high[16:112,16:112,8:48,3],.95))
    if not np.isfinite(scale) or scale<=0:
        return {'file':item['file'],'scale':scale,'passed':False,'reason':'normalization_failed'}
    high/=scale
    air,nonzero=box_powers(high,[(0,0),(0,120),(120,0),(120,120)])
    faces,_=box_powers(high,[(0,60),(120,60),(60,0),(60,120)])
    floor=float(np.median(air))
    mask=(high[box][...,3]>.1)&(b1[box]>=.5)&(b1[box]<=1.5)
    signal=high[box][mask];angles=b1[box][mask,None]*HIGH
    low_angle=b1[box][mask]*np.deg2rad(1.)
    with np.errstate(divide='ignore',invalid='ignore'):
        x=signal/np.tan(angles);y=signal/np.sin(angles)
        x0=x-x.mean(axis=1,keepdims=True);y0=y-y.mean(axis=1,keepdims=True)
        slope=np.sum(x0*y0,axis=1)/np.sum(x0*x0,axis=1)
        intercept=y.mean(axis=1)-slope*x.mean(axis=1)
        predicted=intercept*np.sin(low_angle)/(1-slope*np.cos(low_angle))
        usable=(slope>=0)&(intercept>=0)&np.isfinite(predicted)
        fraction=floor/(predicted[usable]**2+floor)
        ratio=faces/floor;spread=float(np.max(air)/np.min(air))
    middle=float(np.median(fraction)) if len(fraction) else None
    gates={'positive_finite':bool(np.all(np.isfinite(air)) and np.all(np.isfinite(faces)) and np.min(air)>0 and np.min(faces)>0),
           'nonzero_at_least_95pct':nonzero>=.95, 'high_angle_spread_under_1_50':spread<=1.5,
           'face_transfer_in_interval':bool(np.all((ratio>=.67)&(ratio<=1.50))),
           'nonempty_foreground':bool(mask.any()), 'median_fraction_over_1pct':middle is not None and middle>.01}
    return {'file':item['file'],'normalizer':scale,'corner_nonzero_fraction':nonzero,'floor':floor,'corner_power':air.tolist(),'face_power':faces.tolist(),
            'max_min_high_ratio':spread,'face_to_floor':ratio.tolist(),'foreground':int(mask.sum()),'central_voxels':mask.size,
            'source_fit_usable':int(usable.sum()),'median_first_angle_floor_fraction':middle,'gates':gates,'passed':all(gates.values())}


def main():
    root=Path(sys.argv[1])
    files=json.loads(Path(sys.argv[2]).read_text())
    inputs=[r for r in files if r['file']['name'].startswith('vfagre3_vfa') and r['file']['folder'] in ('Phantom/Commercial_1','Phantom/Prototype_1')]
    assert len(inputs)==6
    rows=[]
    for item in sorted(inputs,key=lambda r:r['file']['id']):
        result=evaluate(root/(str(item['file']['id'])+'.mat'),item)
        print('DEVELOPMENT',json.dumps(result,sort_keys=True,allow_nan=False),flush=True);rows.append(result)
    print('ADMISSION',json.dumps({'passed':all(r['passed'] for r in rows),'runs':6,'external_images':0,'low_angles':0,
                                  'per_vial_NMR':0,'stored_fits':0,'organizer_masks':0},sort_keys=True),flush=True)


if __name__=='__main__':
    main()
