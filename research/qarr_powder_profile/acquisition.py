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
def angles(b):
    # Only the first ASCII column is parsed in this metadata route.
    out=[float(row.split(maxsplit=1)[0]) for row in b.splitlines() if row.strip()]
    assert len(out)==7251 and max(abs(x-(5+i*.02)) for i,x in enumerate(out))<2e-10
    return out
def values(b):
    angles(b);out=[float(row.split()[1]) for row in b.splitlines() if row.strip()]
    assert min(out)>=0 and all(map(math.isfinite,out))
    return out
def header(fn,name):
    b=fn('tests/data/qarr/'+name+'.rd');hdr=b[:238];assert hdr[:4]==b'V3RD' and len(b)==14752
    step,start,end=struct.unpack_from('<ddd',hdr,214)
    assert abs(step-.02)<1e-10 and start==5 and end==150
    return [name,sha(b),list(hdr[84:87]),step,start,end,len(b)]
def qualify():
    raw,fn=acquire()
    print('V3RD',json.dumps([header(fn,'corundum'),header(fn,'cpd-1e')]),flush=True)
    gs=git('EdgarGF93/gsas_tutorial',P['source']['gsas_tutorial'])
    maud=git('luttero/maud',P['source']['maud'])
    for n in P['source']['files']:
        b=raw(n);a=angles(b);print('GRID',n,len(b),sha(b),len(a),a[0],a[-1],flush=True)
        if n in ('cpd-1g','cpd-1h'):assert gs(n+'.prn')==b
        if n=='cpd-1h':assert b.splitlines()==maud('src/examples/CPD-1H.PRN').splitlines()
    print('Source metadata precheck complete. Both native headers and eleven grids agree. Zero intensity values decoded.',flush=True)
if __name__=='__main__':qualify()
