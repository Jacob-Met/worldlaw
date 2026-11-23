import hashlib,json,pathlib
p=pathlib.Path("/tmp/hamon-s-1000/37b9acbc0bc94f3b8d00a667990a0cb6/p3-quartz-metadata-8puqld6q.json");raw=p.read_bytes(); assert len(raw)==1137718 and hashlib.sha256(raw).hexdigest()=="96a84e9197b8966763b1ca9cac2d981bf14c21511b7ce0dd3f6a61e381776b0f"
x=json.loads(raw); a=x['headers']; digest={r[0]:r[2] for r in x['files']}
def temp(r):return float(r[1]['sample_temperature/°c'].replace(',','.'))
def fields(r):return tuple(r[1][k] for k in ['sensor','beam_enlargement/mm','laser_voltage/v','laser_filter/mm','analog_filter/ms','ampl_gain'])
def mini(r):return dict(path=r[0].split('deposit/',1)[1],sha256=digest[r[0]],temp=temp(r),thickness_mm=float(r[1]['thickness_rt/mm'].replace(',','.')),samples=r[2],start_ms=float(r[3]),end_ms=float(r[4]))
roster=[]
for x in a:
    f=x[0].split('/')[2]
    if not f.startswith('HT2_') or temp(x)>=150:continue
    src=[r for r in a if r[0].split('/')[2]==f.replace('HT2','HT1') and abs(temp(r)-temp(x))<=2 and fields(x)==fields(r)]
    if src:roster.append(dict(direction=f[-3:],target=mini(x),source=sorted(map(mini,src),key=lambda e:e['path']),settings=fields(x)))
assert len(roster)==18
print(json.dumps(roster,sort_keys=True,separators=(',',':')))