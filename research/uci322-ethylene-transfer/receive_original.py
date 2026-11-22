"""Stream the original UCI archive and index its members, without parsing any sensor or setpoint column."""
import hashlib
import json
import sys
from pathlib import Path
import urllib.request
import zipfile

root=Path(sys.argv[1])
source='https://archive.ics.uci.edu/static/public/322/gas+sensor+array+under+dynamic+gas+mixtures.zip'
target=root/'uci322-original.zip'
with urllib.request.urlopen(source,timeout=180) as h, target.open('xb') as f:
    dig=hashlib.sha256()
    while block:=h.read(1<<20):
        dig.update(block);f.write(block)
with zipfile.ZipFile(target) as z:
    members=[(v.filename,v.file_size,v.compress_size,v.CRC) for v in z.infolist()]
res=dict(source=source,bytes=target.stat().st_size,sha256=dig.hexdigest(),central_directory=members,decoded_members=[])
(root/'immutable-source.json').write_text(json.dumps(res,indent=2))
print('ARCHIVE',json.dumps(res),flush=True)
