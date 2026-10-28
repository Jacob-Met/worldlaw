"""Run after prepare-pixels.mjs. PNG byte hashes may vary with encoder versions."""
from pathlib import Path
from PIL import Image
import hashlib,json
p=Path(__file__).parent/'pixels'
rows=[]
for name in ['source','stationary','quadratic0.2','quadratic0.8','quadratic2.4','complete-turn']:
 raw=(p/(name+'.rgba')).read_bytes()
 assert len(raw)==128*128*4
 Image.frombytes('RGBA',(128,128),raw).save(p/(name+'.png'))
 rows.append(dict(name=name,rgbaSHA256=hashlib.sha256(raw).hexdigest(),pngSHA256=hashlib.sha256((p/(name+'.png')).read_bytes()).hexdigest()))
(p/'manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
