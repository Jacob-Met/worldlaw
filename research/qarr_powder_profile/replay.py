"""Verify the shipped lock, receipts, all 24 reported scores and frozen acceptance."""
import base64,hashlib,json,math,sys,zlib
from pathlib import Path
root=Path(sys.argv[1]).resolve()
def read(n):return (root/n).read_bytes()
def h(b):return hashlib.sha256(b).hexdigest()
def js(n):return json.loads(read(n))
p=js('protocol.json'); pin=js('forecast-lock.json')
b=zlib.decompress(base64.b85decode(read('forecast-lock.b85.txt').strip()));assert h(b)==pin['sha256']
l=json.loads(b);assert l['protocol_sha256']==h(read('protocol.json')) and l['matrix_sha256']==pin['matrix_sha256'] and l['matrix_bytes']==3*8*7251*8
s=js('score.json');rec=js('native-receipts.json')
assert len(rec)==10 and len({i['job_id'] for i in rec})==10 and all(i['descendants']=='drained' for i in rec)
def native(j,name):i=next(x for x in rec if x['job_id']==j);raw=read(name);assert h(raw)==i['output_sha256'] and len(raw)==i['output_bytes'];return raw
for suffix,name in [('three-weighed-specimens-locked-whole-profile-scores','score-original.txt'),('independent-nonblank-record-decimal174024-verification','independent-original.txt')]:
    b=native('p3-f747-qarr-'+suffix,name)
    if name.startswith('score'):assert json.loads(b.split(b'FULL_SCORE ')[1])==s
    else:
        independent=json.loads(b.split(b'INDEPENDENT ')[1]);assert independent['score_sha256']==h(read('score.json')) and independent['differences']==174024
for r in l['roles']:
    assert s['means'][r]==math.fsum(s['held'][c][r]['rms'] for c in p['held'])/3
    if r!='projective':assert s['wins'][r]==sum(s['held'][c]['projective']['rms']<s['held'][c][r]['rms'] for c in p['held'])
gate=all(s['means']['projective']<s['means'][r] for r in l['roles'][1:]) and min(s['wins']['peak_fit'],s['wins']['pure_mac'])>=2
assert gate==s['gate']==independent['gate']==False
print('Replayed 24 whole-specimen scores, original forecast-lock pins and two authenticated native outputs. Registered gate false.')
