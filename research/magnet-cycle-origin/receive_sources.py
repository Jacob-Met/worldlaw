"""Fetch only source-pinned inference inputs. Final truths and published predictions are excluded."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.request

root=Path(sys.argv[1]); files=json.loads(sys.argv[2]); assert len(files)==26
assert all('/Result/' not in p and '/finaltest/' not in p for _,_,p,_ in files)
def receive(rec):
    repo,ref,name,digest=rec
    url='https://raw.githubusercontent.com/'+repo+'/'+ref+'/'+urllib.parse.quote(name)
    target=root/'scientific-source'/name
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists():
        data=target.read_bytes()
    else:
        with urllib.request.urlopen(url,timeout=100) as f: data=f.read()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+bytes([0])+data).hexdigest()==digest,name
    if not target.exists(): target.write_bytes(data)
    return [name,digest,hashlib.sha256(data).hexdigest(),len(data)]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    checked=list(pool.map(receive,files))
path=root/'model-source-ledger.json';path.write_text(json.dumps(checked,indent=2))
print('VERIFIED',len(checked),sum(i[3] for i in checked),hashlib.sha256(path.read_bytes()).hexdigest(),flush=True)
