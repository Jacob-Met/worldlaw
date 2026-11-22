"""Independent clock grid, MATLAB v5 density, and exact arithmetic receiver."""
import hashlib
import json
import struct
import sys
import zlib
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from zipfile import ZipFile


def elements(data):
    i=0
    while i+8<=len(data):
        tag,size=struct.unpack_from('<II',data,i)
        short=tag>>16
        if short:
            if short>4:raise ValueError('bad inline field')
            yield tag&65535,data[i+4:i+4+short];i+=8
        else:
            if size>len(data)-i-8:raise ValueError('short matrix field')
            if not tag:return
            yield tag,data[i+8:i+8+size]
            i+=8+(size if tag==15 else ((size+7)//8)*8)


def matrix(blob):
    assert blob[126:128]==b'IM'
    for typ,vals in elements(blob[128:]):
        if typ==15:container=list(elements(zlib.decompress(vals)))
        else:container=[(typ,vals)]
        for t,d in container:
            if t!=14:continue
            fields=list(elements(d))
            if fields[2][1]!=b'X':continue
            n,m=struct.unpack('<ii',fields[1][1]);assert n==m and fields[3][0]==9
            raw=fields[3][1];assert len(raw)==8*n*m
            out=bytearray();nnz=0;negative=0;up=0;dn=0
            for row in range(n):
                for col in range(m):
                    i=(col*n+row)*8;val=struct.unpack_from('<d',raw,i)[0]
                    out.extend(raw[i:i+8]);nnz+=(val!=0);negative+=(val<0);up+=(val!=0 and col>row);dn+=(val!=0 and col<row)
            return n,nnz,negative,up,dn,hashlib.sha256(out).hexdigest()
    raise ValueError('No numeric X')


def check(archive,original):
    manifest=json.loads(original.read_text());clock_rows={};map_recounts={}
    with ZipFile(archive) as z:
        for name,release in manifest['clocks'].items():
            with z.open(name) as src:
                hdr=[src.readline().decode('utf-8-sig').strip() for _ in range(6)]
                assert hdr==release['header']
                count=0
                for line in src:
                    # Stop at the first semicolon; downstream signal text is never converted.
                    i=line.find(b';');assert i>0 and line.count(b';')==1 and line[i+1:].strip()
                    assert Decimal(line[:i].decode())*500000==count
                    count+=1
            assert count==release['rows'];clock_rows[name]=count
        for name,record in manifest['author_density'].items():
            n,nnz,neg,up,dn,digest=matrix(z.read(name))
            assert [n,n]==record['shape'] and (nnz,neg,up,dn,digest)==(
                record['count_nonzero'],record['negative'],record['upper_nonzero'],
                record['lower_nonzero'],record['coefficient_sha256_F64LE_rowmajor'])
            map_recounts[name]=digest
    # Independent sum of the impulse response of causal v[t]=(u[t]+v[t-1])/2.
    u=manifest['mathematical_control']['command']
    values=[sum(Fraction(u[j],2**(i-j+1)) for j in range(i+1)) for i in range(len(u))]
    states=[];active=False
    for pos in values:
        active=(pos>=3 or (active and pos>1));states.append(int(active))
    assert [str(v) for v in values]==manifest['mathematical_control']['filtered_voltage_exact']
    assert states==manifest['mathematical_control']['both_output_histories']
    return {'clock_rows':clock_rows,'complete_position_rows_unopened':sum(clock_rows.values()),
            'independent_author_parameter_sha256':map_recounts,'exact_control_output':states}


if __name__=='__main__':
    archive,original,out=map(Path,sys.argv[1:]);result=check(archive,original)
    out.write_text(json.dumps(result,indent=2)+'\n')
    print('INDEPENDENT',json.dumps(result),flush=True)
    print('COMPLETE',hashlib.sha256(out.read_bytes()).hexdigest(),out,flush=True)
