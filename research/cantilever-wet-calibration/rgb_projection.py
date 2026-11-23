"""Lossless RGB bytes from the two authorized anchor input strips."""
import base64, hashlib, io, json, sys, zipfile, zlib
from pathlib import Path
from PIL import Image
raw=Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(raw).hexdigest()=='7c02c144eec191841a07122545406dd70f33992b667883861820e9ab750356e3'
with zipfile.ZipFile(io.BytesIO(raw)) as z:
    jpeg=z.read('c6an02674e-f2.jpg')
image=Image.open(io.BytesIO(jpeg)).convert('RGB')
assert hashlib.sha256(jpeg).hexdigest()=='d27c2ab49d053afa852428c8751fb4d8bc0a2fbf8fa7bdedaadc7521275dddff'
data={}
for x in [115,201]:
    rgb=image.crop((x-6,40,x+7,441)).tobytes()
    data[x]={'sha256':hashlib.sha256(rgb).hexdigest(),'deflate_base64':base64.b64encode(zlib.compress(rgb)).decode()}
print(json.dumps(data,sort_keys=True))