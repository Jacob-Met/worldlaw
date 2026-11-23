import io,json,hashlib,os,pathlib,subprocess,tempfile,urllib.request
root=pathlib.Path(tempfile.mkdtemp(prefix='rible-source-',dir=os.environ.get('TMPDIR')))
def get(cmd):return subprocess.check_output(cmd,cwd=root)
get(['git','init','-q'])
ref='e8e7bc57ac6682b4005b2e97d140b6aa3517b2c0'
get(['git','fetch','-q','--depth=1','https://github.com/genepatrickrible/Aerodynamic-levitation-of-nanofluid-drops.git',ref])
key='Vertical Wind Tunnel Code/Cache/rawData.mat'
m=get(['git','show',ref+':'+key]); mat=root/'rawData.mat';mat.write_bytes(m)
print('MAT_SOURCE',len(m),hashlib.sha256(m).hexdigest(),flush=True)
import struct,zlib
# MATLAB v5 directory inspection. Read array flags, dimensions and variable names only;
# MCOS opaque objects have a distinct header and are retained as opaque descriptors.
assert m[126:128]==b'IM'
def sub(b,i):
    tag,=struct.unpack_from('<I',b,i)
    if tag>>16:return tag&65535,tag>>16,i+4,i+8
    n,=struct.unpack_from('<I',b,i+4)
    return tag,n,i+8,i+8+((n+7)//8)*8
def read_header(b):
    kind,n,offset,_=sub(b,0)
    assert kind==14
    k,size,ptr,i=sub(b,offset);assert k==6 and size==8
    cl=struct.unpack_from('<I',b,ptr)[0]&255
    if cl==17:return {'class':cl,'scope':'opaque-object-header-only','matrix_bytes':n}
    k,size,ptr,i=sub(b,i);assert k==5 and size<=128
    dim=struct.unpack_from('<'+'i'*(size//4),b,ptr)
    k,size,ptr,i=sub(b,i);assert k==1 and size<=256
    return {'name':b[ptr:ptr+size].decode('latin1'),'class':cl,'shape':dim,'matrix_bytes':n}


from array import array
def payload(x):
    typ,sz,d,_=sub(x,0);assert typ==14
    q=d
    for n in range(3):
        k,nb,at,q=sub(x,q)
        if n==2:name=x[at:at+nb].decode('utf-8')
    return name,q
def struct_fields(x):
    name,q=payload(x)
    _,_,at,q=sub(x,q);width=struct.unpack_from('<i',x,at)[0]
    _,sz,at,q=sub(x,q)
    names=[x[k:k+width].split(bytes([0]),1)[0].decode('ascii') for k in range(at,at+sz,width)]
    out={}
    for label in names:
        k,n,off,nq=sub(x,q)
        out[label]=x[q:nq];q=nq
    return out
def get_numeric(x):
    q=8
    _,_,_,q=sub(x,q);_,n,off,q=sub(x,q)
    shape=struct.unpack_from('<'+'i'*(n//4),x,off)
    _,_,_,q=sub(x,q);k,n,off,nq=sub(x,q)
    assert k==9 and n==shape[0]*shape[1]*8
    return shape,struct.unpack_from('<'+'d'*(n//8),x,off)
i=128
while i<len(m):
    kind,sz,ptr,nxt=sub(m,i)
    if kind==15:
        r=zlib.decompressobj().decompress(m[ptr:ptr+sz],512)
        if read_header(r).get('name')=='camera1Stats':
            raw=zlib.decompress(m[ptr:ptr+sz]);break
        i=ptr+sz
    else:i=nxt
else:raise ValueError('source pixel descriptors missing')
field=struct_fields(raw)
selected={'bbox_heigth':('bbox',4),'bbox_width':('bbox',3),'majorAxis':('ma',1),'minorAxis':('mi',1),'cantingAngle':('angle',1),'verticalAxis':('Vert',1)}
import csv,zipfile,urllib.request,math
url='https://zenodo.org/records/18896271/files/Data_Corrected.zip?download=1'
with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Calibrated paired-camera training-archive qualification'}),timeout=90) as f:b=f.read(20343113)
assert len(b)==20343112 and hashlib.sha256(b).hexdigest()=='f48db4e3a6b9992ed6d040ac1a5fba2881a2c8a469c3a4fb6853af0595652307'
z=zipfile.ZipFile(io.BytesIO(b)); base='Data_Corrected/Camera1/'
def rows(name):return list(csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig')))
movie='E3_R1_DW_Green_1_25_24';obs=rows(base+'TimeData/'+movie+'.csv')
scale=next(float(d['resolution_pxls_per_mm']) for d in rows(base+'Properties_Cam1.csv') if d['ID']==movie)
res={};modes=[]
for col,(key,idx) in selected.items():
    (n,nc),v=get_numeric(field[key]);assert nc>idx and all(v[i]==i+1 for i in range(n))
    assert len(obs)==n and all(int(d['frame_no'])==i+1 for i,d in enumerate(obs))
    px=v[idx*n:(idx+1)*n]
    factors={'degrees':1.0} if col=='cantingAngle' else {'pixels':1.,'mm':1./scale,'literal_times_ten':10.}
    errs={mode:max(abs(float(d[col])-p*frac) for d,p in zip(obs,px)) for mode,frac in factors.items()}
    matching=[mode for mode,e in errs.items() if e<1e-5]
    res[col]={'count':n,'max_abs_difference':errs,'matching':matching,'frame1_raw_pixel_or_degree':px[0],'frame1_release':float(obs[0][col])}
    if col!='cantingAngle':modes.append(matching)
print('UNIT_AUDIT',json.dumps(res,sort_keys=True),flush=True)
assert all(m==modes[0] and len(m)==1 for m in modes) and res['cantingAngle']['matching']==['degrees'], 'source unit/segmentation correspondence refused'
print('SCALE',modes[0][0],'No held camera2 values accessed.')
