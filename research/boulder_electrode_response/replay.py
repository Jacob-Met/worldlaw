"""Replay the source eligibility and independently reproduced marker counts offline."""
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]);read=lambda n:(root/n).read_bytes();h=lambda b:hashlib.sha256(b).hexdigest()
p=json.loads(read('protocol.json'));m=json.loads(read('eligibility.json'));jobs=json.loads(read('native-receipts.json'))
assert len(jobs)==5 and all(x['descendants']=='drained' for x in jobs)
assert [v['exit_code'] for v in jobs]==[0,1,0,0,0]
for j,n in zip(jobs,['header-original.txt','registry-dns-refusal.txt','unit-original.txt','mask-original.txt','independent-original.txt']):
    raw=read(n);assert len(raw)==j['output_bytes'] and h(raw)==j['sha256']
assert json.loads(read('mask-original.txt').split(b'MASK_RESULT ')[1])==m
z=json.loads(read('independent-original.txt').split(b'INDEPENDENT ')[1])
assert z['mask_sha256']==h(read('eligibility.json')) and z['utc_rows']==14*86400 and z['electrode_or_magnetic_values_decoded']==0
for d in p['dev']+p['held']:
    row=m['dates'][d];ind=z['days'][d]
    for k in ('B','E'):
        assert row[k]['rows']==86400 and row[k]['valid_windows']==ind[k]['complete']
        assert sum(ind[k]['missing_individual'])-ind[k]['both_missing']==row[k]['missing_rows']
    assert row['eligible']==sorted(set(ind['E']['complete'])&set(ind['B']['complete']))
ok=all(len(m['dates'][d]['eligible'])>=12 for d in p['dev']+p['held'])
assert ok==m['qualified']==z['qualified']==False
assert z['days']['2023-04-24']['E']['token_counts']==[{'99999.00':86400}]*2
print('All 14 immutable-mask identities, two native gate receipts and seven event counts verified. Both electric channels are absent for every April 24 2023 second; no spectrum scored.')
