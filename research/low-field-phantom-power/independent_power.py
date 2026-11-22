"""Independent MAT projection and physical corner/face power recount, six development scans."""
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import sys
import zlib
import numpy as np
from scipy.io import loadmat


def word(buf, offset):
    length, kind = struct.unpack_from('<HH',buf,offset)
    if kind:
        return length,kind,offset+4,offset+8
    size,=struct.unpack_from('<I',buf,offset+4)
    return length,size,offset+8,offset+8+8*((size+7)//8)


def high_only(mat):
    prefix=mat[:128]
    ptr=128
    while ptr<len(mat):
        _,c,begin,_=word(mat,ptr);ptr=begin+c
        block=zlib.decompress(mat[begin:ptr])
        _,_,data_start,_=word(block,0)
        _,_,_,flags_end=word(block,data_start)
        _,dim_length,dim_at,dim_end=word(block,flags_end)
        _,name_len,name_at,name_end=word(block,dim_end)
        if block[name_at:name_at+name_len]!=b'D':
            continue
        dims=struct.unpack_from('<'+'i'*(dim_length//4),block,dim_at)
        if dims!=(128,128,56,7):raise ValueError('unexpected voxel array')
        kind,value_bytes,value_at,_=word(block,name_end)
        if value_bytes%7:raise ValueError('seven equal-volume spans required')
        span=value_bytes//7
        head=bytearray(block[data_start:name_end])
        struct.pack_into('<i',head,dim_at-data_start+12,4)
        payload=bytes(head)+struct.pack('<II',kind,4*span)+block[value_at+3*span:value_at+7*span]
        new_mat=prefix+struct.pack('<II',14,len(payload))+payload
        recovered=loadmat(io.BytesIO(new_mat),variable_names=['D'])['D']
        assert recovered.shape==(128,128,56,4)
        return recovered
    raise ValueError('D missing')


def run(root,schema,expected):
    inventory={f['file']['id']:f for f in schema}
    rows=[];worst=None
    for ref in expected['development']:
        item=ref['file'];source=(root/(str(item['id'])+'.mat')).read_bytes()
        assert inventory[item['id']]['sha256']==hashlib.sha256(source).hexdigest()
        if item['folder'] not in ('Phantom/Commercial_1','Phantom/Prototype_1'):raise ValueError('outside development')
        data=high_only(source)
        values=data[16:112,16:112,8:48,3].ravel()
        # Explicit order statistic with linear interpolation matches the registered 95th percentile.
        ordered=np.sort(values);p=.95*(len(ordered)-1);i=int(p)
        scale=float((1-(p-i))*ordered[i]+(p-i)*ordered[i+1])
        assert math.isclose(scale,ref['normalizer'],rel_tol=2e-12)
        boxes={'corners':[(0,0),(0,120),(120,0),(120,120)],'faces':[(0,60),(120,60),(60,0),(60,120)]}
        detail={}
        for typ,coordinates in boxes.items():
            tiles=[]
            for x,y in coordinates:
                aa=data[x:x+8,y:y+8,8:48,:]/scale
                tile=[math.fsum(float(v)**2 for v in aa[:,:,:,k].ravel())/2560 for k in range(4)]
                tiles.append({'origin_xy':[x,y],'mean_power':tile})
            detail[typ]=tiles
        corner=np.mean([t['mean_power'] for t in detail['corners']],axis=0)
        faces=np.mean([t['mean_power'] for t in detail['faces']],axis=0)
        floor=float(np.median(corner));ratio=faces/floor
        assert np.allclose(corner,ref['corner_power'],rtol=2e-12,atol=0)
        assert np.allclose(faces,ref['face_power'],rtol=2e-12,atol=0)
        assert np.allclose(ratio,ref['face_to_floor'],rtol=2e-12,atol=0)
        assert bool(np.all((ratio>=.67)&(ratio<=1.5)))==ref['gates']['face_transfer_in_interval']
        peak=int(np.argmax(ratio))
        if worst is None or ratio[peak]>worst['ratio']:
            worst={'file':item['name'],'angle_deg':[5.4772,9.6549,17.019,30.][peak],'ratio':float(ratio[peak]),
                   'pooled_corner_floor':floor,'face_powers':[t['mean_power'][peak] for t in detail['faces']],
                   'face_origins_xy':coordinates,'whole_4face_power':float(faces[peak])}
        rows.append({'file':item['name'],'boxes':detail})
    assert len(rows)==6
    return {'independent':True,'development_runs':len(rows),'tile_means':len(rows)*8*4,
            'authenticated_low_images_decoded':0,'external_images_decoded':0,'spatial_gate':False,'worst':worst,'all_runs':rows}


if __name__=='__main__':
    result=run(Path(sys.argv[1]),json.loads(Path(sys.argv[2]).read_text()),json.loads(Path(sys.argv[3]).read_text()))
    print(json.dumps(result,sort_keys=True,allow_nan=False))
