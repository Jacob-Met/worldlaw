"""Receive the alternative archive explicitly linked by the 2023 organizing committee."""
import hashlib
import json
from pathlib import Path
import sys
import urllib.request
import zipfile

root=Path(sys.argv[1])
url='https://www.dropbox.com/sh/q5w2ddol8y6bk0k/AABXKxv_aiLj8yXspeusJq4na?dl=1'
path=root/'final-competition-share.zip'
with urllib.request.urlopen(url,timeout=150) as response:
    print('HEADERS', response.status,response.headers.get('Content-Type'),response.headers.get('Content-Length'),flush=True)
    prefix=response.read(4)
    if prefix!=b'PK\x03\x04': raise ValueError('Public organizer share did not serve a ZIP; no alternate bytes consumed')
    dig=hashlib.sha256();dig.update(prefix)
    with path.open('xb') as f:
        f.write(prefix)
        while data:=response.read(1<<20):
            f.write(data);dig.update(data)
with zipfile.ZipFile(path) as z:
    roster=[{'path':x.filename,'bytes':x.file_size,'crc':x.CRC} for x in z.infolist() if not x.is_dir()]
out={'url':url,'size':path.stat().st_size,'sha':dig.hexdigest(),'members':roster,'decoded_scientific_arrays':0}
(root/'organizer-share-roster.json').write_text(json.dumps(out,indent=2));print('ARCHIVE',out['size'],out['sha'],'FILES',[(x['path'],x['bytes']) for x in roster[:55]])
