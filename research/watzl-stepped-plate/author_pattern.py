"""Read immutable author MAT structure, selectively decoding only explicitly requested members."""
import json,struct,zlib,os
import numpy as np
from pathlib import Path
from hashlib import sha256

p=Path(os.environ['WATZL_DATA'])/'AA7075_pattern_variation_peakFinding_results.mat'
SOURCE='fee779205a0367d9f3b714881b90beebdeb4f2e57e5e265b66da37d1c61eed2c'
def token(data,at):
 a,n=struct.unpack_from('<II',data,at)
 if a>>16:
    return a&65535,data[at+4:at+4+(a>>16)],at+8
 return a,data[at+8:at+8+n],at+8+((n+7)//8)*8

def inventory():
 b=p.read_bytes();assert sha256(b).hexdigest()==SOURCE and b[126:128]==b'IM'
 a,n=struct.unpack_from('<II',b,128);s=zlib.decompress(b[136:136+n]) if a==15 else b[128:]
 kind,b,_=token(s,0);assert kind==14
 k,flags,pos=token(b,0);assert flags[0]==2
 _,dim,pos=token(b,pos);dimensions=struct.unpack('<'+'i'*(len(dim)//4),dim)
 _,name,pos=token(b,pos);assert name==b'results'
 _,width,pos=token(b,pos);_,names,pos=token(b,pos)
 fields=[n.decode() for n in names.split(b'\0') if n]
 rows=[]
 for _ in range(int(np.prod(dimensions))):
    row={}
    for f in fields:
      k,data,pos=token(b,pos);assert k==14;row[f]=data
    rows.append(row)
 return rows

TYPES={1:'i1',2:'u1',3:'<i2',4:'<u2',5:'<i4',6:'<u4',7:'<f4',9:'<f8',12:'<i8',13:'<u8'}
def read_numeric(matrix):
 _,flag,p=token(matrix,0);assert flag[0] not in (1,2,4,5)
 _,d,p=token(matrix,p);dims=struct.unpack('<'+'i'*(len(d)//4),d)
 _,name,p=token(matrix,p);kind,raw,p=token(matrix,p)
 return np.frombuffer(raw,dtype=TYPES[kind]).reshape(dims,order='F').squeeze()

if __name__=='__main__':
 rows=inventory();out=[]
 for idx,row in enumerate(rows):
    key=[read_numeric(row[k]).item() for k in ['n_spots','img_size_px','delta_px']]
    if key!=[20,400,5]:continue
    res={'array_index_zero_based':idx,'pattern_key':key}
    for k in ['periodicity','trange_SAW','trange_S1S2','win_saw','win_S1S2']:
       v=read_numeric(row[k])
       res[k]={'shape':list(v.shape),'minimum':float(v.min()),'maximum':float(v.max()),'value':v.tolist() if v.size<14 else None,'sha256_array_bytes':sha256(v.tobytes()).hexdigest()}
    out.append(res)
 print(json.dumps({'matching':out,'tested_pattern_records':len(rows),'caliper_or_author_output_values_read':0},indent=2))
