"""Read only the authenticated fixed-position power files."""
from fractions import Fraction
from pathlib import Path
import ctypes, ctypes.util, hashlib, re
DIGEST='de3047ac52facc69bacd037f93ee9c06532a3c21f9a0259b7a7f78337f7e24e3'
SIGNS=(1,-1,-1,-1,1,1,1,-1)
MASKS=['1, 1, 1','1, 1, 0','1, 0, 1','0, 1, 1','1, 0, 0','0, 1, 0','0, 0, 1','0, 0, 0']
def load_fixed(path):
    path=Path(path);assert hashlib.sha256(path.read_bytes()).hexdigest()==DIGEST
    c=ctypes.CDLL(ctypes.util.find_library('archive') or 'libarchive.so.13');ptr=ctypes.c_void_p
    def fn(n,a,r):
        v=getattr(c,n);v.argtypes=a;v.restype=r;return v
    arch=fn('archive_read_new',[],ptr)()
    for n in ('archive_read_support_format_all','archive_read_support_filter_all'):assert fn(n,[ptr],ctypes.c_int)(arch)==0
    assert fn('archive_read_open_filename',[ptr,ctypes.c_char_p,ctypes.c_size_t],ctypes.c_int)(arch,str(path).encode(),65536)==0
    head=fn('archive_read_next_header',[ptr,ctypes.POINTER(ptr)],ctypes.c_int);name=fn('archive_entry_pathname',[ptr],ctypes.c_char_p)
    length=fn('archive_entry_size',[ptr],ctypes.c_int64);read=fn('archive_read_data',[ptr,ptr,ctypes.c_size_t],ctypes.c_ssize_t)
    skip=fn('archive_read_data_skip',[ptr],ctypes.c_int);entry=ptr();rows={}
    while True:
        rc=head(arch,ctypes.byref(entry))
        if rc==1:break
        assert rc==0
        match=re.fullmatch(r'MATLAB/data/fixedZ/cycle(\d+)_pos_idx0_state_idx(\d+)\.txt',name(entry).decode())
        if match:
            cycle,state=map(int,match.groups());n=length(entry);buf=ctypes.create_string_buffer(n)
            assert read(arch,buf,n)==n
            s=buf.raw.decode('ascii').splitlines();assert s[3]=='# Start date/time: 1622475103.7339206'
            assert s[8]=='# state: ['+MASKS[state]+']' and s[9]=='# Data point; Power (mW)'
            rec=[v.split(';') for v in s[10:] if v.strip()]
            assert len(rec)==500 and all(len(v)==2 for v in rec)
            assert (cycle,state) not in rows
            rows[cycle,state]=[SIGNS[state]*Fraction(v[1].strip()) for v in rec]
        assert skip(arch)>=0
    assert set(rows)=={(c,s) for c in range(640,741) for s in range(8)}
    return {c:[rows[c,s] for s in range(8)] for c in range(640,741)}
