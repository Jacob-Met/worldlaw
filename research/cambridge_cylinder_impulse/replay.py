"""Offline receipt and geometric contract replay, with exact contour signs."""
import hashlib,json,pathlib,sys
from contour_identities import check
p=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '.')
j=lambda n:json.loads((p/n).read_bytes())
H=lambda b:hashlib.sha256(b).hexdigest()
s=j('independent-source-result.json');a=j('mask-clock-result.json');i=j('mask-recount.json');receipts=j('native-receipts.json')
assert len(receipts)==8 and sum(x['exit']!=0 for x in receipts)==2 and all(x['descendant']=='drained' for x in receipts)
assert i['source_sha256']==s['source_sha256']=='be4bca8565b16ecb8c0d992f5c9c3a9028e88a44ffbc64319c8a4181eb9e1367'
assert s['load_cells_decoded']==s['piv_velocity_values_decoded']==i['load_and_PIV_velocity_cells_decoded']==0
assert [s['cases'][str(k)]['width_histogram'] for k in (0,1,3)]==[{'3':30000},{'3':40000},{'7':40000}]
assert s['cases']['3']['steady_median_rpm']==137.03593 and s['cases']['3']['raw_max_kinematic_row'][-1]==138.6654
assert H((p/'mask-clock-result.json').read_bytes())==i['digest_of_reference']
assert i['verified_frames']==126 and i['paired_frames']==80
for k in ('0','1','3'):
    frames=a[k]['frames'];run=mx=0;pair=0
    for q in frames:
        d=q.get('differences')
        if d:pair+=1
        flag=bool(d and d[0]*d[1]>0 and min(map(abs,d))>.015)
        run=run+1 if flag else 0;mx=max(mx,run)
    assert [mx,pair]==i['cases'][k][:2] and mx>=3 and a[k]['flagged']
assert check()==30
print('Complete source contract, 110000 row widths, 126 mask frames and 30 exact contour identities reproduced. Cross-spin force transfer unscored.')
