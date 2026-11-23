"""Offline readback of the pinned roster, forecast bytes, metrics, exposure and two independent records."""
import base64,hashlib,json,math,pathlib,struct,sys,zlib
p=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '.')
def read(n):return (p/n).read_bytes()
def obj(n):return json.loads(read(n))
def H(b):return hashlib.sha256(b).hexdigest()
r=obj('roster.json');lock=obj('forecast-lock.json');spec=obj('protocol.json');s=obj('scores.json');v=obj('independent-result.json');tail=obj('trigger-result.json')
assert len(r)==18 and len(spec['role_order'])==9
assert H(read('roster.json'))==spec['roster_sha256']==lock['roster'] and H(read('protocol.json'))==lock['protocol']
bits=zlib.decompress(base64.b85decode(read('forecasts.b85').strip()));assert len(bits)==18*9*801*8==lock['bytes'] and H(bits)==lock['sha256']==s['forecast']==v['forecast_sha256']==tail['raw_original_sha']
assert [[H(bits[(9*i+j)*6408:(9*i+j+1)*6408]) for j in range(9)] for i in range(18)]==lock['role_digests']
assert all(math.isfinite(t[0]) for t in struct.iter_unpack('<d',bits))
assert [x['target']['sha256'] for x in r]==s['target_digests']==[x['target'] for x in lock['fit']]
assert lock['target_voltages_read']==v['future_cube_records_opened']==0 and v['verified_forecasts']==162 and v['scalar_residuals']==129762
for k in range(9):
    grouped=[sum(row[k] for row in s['shots'][i:i+3])/3 for i in range(0,18,3)]
    assert max(abs(x-y[k]) for x,y in zip(grouped,s['groups']))<1e-13
    assert abs(sum(grouped)/6-s['means'][k])<1e-13 and abs(v['means'][k]-s['means'][k])<2e-12
assert all(row[3]<row[0] for row in s['groups']) and not s['joint'] and not v['joint'] and s['group_wins']==0
assert s['worst']['raw_V']==7.421 and s['worst']['point']==0 and v['worst'][0]==s['worst']['shot']
assert abs(tail['fraction_of_all_shot_squared_error_by_role'][0][0]-.5679356822652261)<1e-12
native=obj('native-receipts.json'); assert len(native)==13 and sum(x['exit_code']!=0 for x in native)==1
print('Verified original 162 forecast arrays, all 18 shot scores for nine roles, 54 group scores, nine means, independent receiver and full-course negative.')
