"""Read organizer benchmark copies from their immutable Git objects."""
import hashlib, json, math, os, pathlib, struct, subprocess, tempfile
from pathlib import Path
BASE=Path(__file__).parent
P=json.loads((BASE/'protocol.json').read_bytes())
def sha(b):return hashlib.sha256(b).hexdigest()
def git(repo,ref):
    path=Path(tempfile.mkdtemp(prefix='qarr-source-',dir=os.environ.get('TMPDIR')))
    def g(*args):return subprocess.check_output(['git',*args],cwd=path)
    g('init','-q');g('remote','add','origin','https://github.com/'+repo+'.git')
    g('config','remote.origin.promisor','true');g('config','remote.origin.partialclonefilter','blob:none')
    g('fetch','-q','--depth=1','--filter=blob:none','origin',ref)
    assert g('rev-parse','FETCH_HEAD').decode().strip()==ref
    return lambda name:g('show',ref+':'+name)
def acquire():
    s=P['source'];fn=git(s['repo'],s['sha'])
    def raw(n):
        b=fn('tests/data/qarr/'+n+'.prn')
        oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        assert oid==s['files'][n];return b
    return raw,fn
def angles(b, native_ordinal=False):
    # Only the first ASCII column is parsed in this metadata route.
    out=[float(row.split(maxsplit=1)[0]) for row in b.splitlines() if row.strip()]
    assert len(out)==7251
    if native_ordinal:
        assert all(round((x-5)/.02)==i and abs(x-(5+i*.02))<=.000011 for i,x in enumerate(out))
    else:
        assert max(abs(x-(5+i*.02)) for i,x in enumerate(out))<2e-10
    return out
def values(b,native_ordinal=False):
    angles(b,native_ordinal);out=[float(row.split()[1]) for row in b.splitlines() if row.strip()]
    assert min(out)>=0 and all(map(math.isfinite,out))
    return out
def header(fn,name):
    b=fn('tests/data/qarr/'+name+'.rd');hdr=b[:238];assert hdr[:4]==b'V3RD' and len(b)==14752
    step,start,end=struct.unpack_from('<ddd',hdr,214)
    assert abs(step-.02)<1e-10 and start==5 and end==150
    return [name,sha(b),list(hdr[84:87]),step,start,end,len(b)]
def source_values(name,b,fn):
    x=values(b,name=='cpd-1e')
    if name in ('corundum','cpd-1e'):
        header(fn,name)
        native=fn('tests/data/qarr/'+name+'.rd')
        assert sha(native)=={'corundum':'5dd3a811f33dd2f95dc0049f93dba9b10bc98c2861bcb617cc9605499316b1ec','cpd-1e':'99aff9a54dd5d2f5c65df49019ff1e4e8de60c7e0a39df0eb2b480f24388eb89'}[name]
        packed=struct.unpack_from('<7251H',native,250)
        assert max(packed)==struct.unpack_from('<H',native,136)[0]
        counts=[float((v*v)//100) for v in packed]
        converted=counts if name=='corundum' else [float((v*v+50)//100) for v in packed]
        assert converted==x,('converter-specific count refusal',name)
        delta=[v-w for v,w in zip(x,counts)]
        assert set(delta)<={0.,1.} and sum(delta)==(2108 if name=='cpd-1e' else 0)
        print('CONVERTER',name,len(delta),sum(delta),flush=True)
        return counts
    return x
def qualify():
    raw,fn=acquire()
    print('V3RD',json.dumps([header(fn,'corundum'),header(fn,'cpd-1e')]),flush=True)
    gs=git('EdgarGF93/gsas_tutorial',P['source']['gsas_tutorial'])
    maud=git('luttero/maud',P['source']['maud'])
    for n in P['source']['files']:
        b=raw(n);a=angles(b,n=='cpd-1e');print('GRID',n,len(b),sha(b),len(a),a[0],a[-1],flush=True)
        if n in ('cpd-1g','cpd-1h'):assert gs(n+'.prn')==b
        if n=='cpd-1h':assert b.splitlines()==maud('src/examples/CPD-1H.PRN').splitlines()
    print('Source metadata precheck complete. Both native headers and eleven grids agree. Zero intensity values decoded.',flush=True)
if __name__=='__main__':qualify()
