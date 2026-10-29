import pathlib,csv,json,hashlib,sys,math
p=pathlib.Path(__file__).parent;protocol=json.loads((p/'protocol.json').read_text());names=sys.argv[1:];runs=[]
for name in names:
 raw=(p/name).read_bytes();rows=list(csv.DictReader(raw.decode('utf-8-sig').splitlines()));samples=[]
 for i,r in enumerate(rows):
  t=float(r['Time (s) Run #1'])
  if 5<=t<=25:
   q=float(r['Angle (rad) Run #1']);v=float(r['Angular Velocity (rad/s) Run #1']);assert all(map(math.isfinite,[t,q,v]));samples.append(dict(time=t,position=q,rate=v))
 assert len(samples)==2001 and all(samples[i]['time']>samples[i-1]['time'] for i in range(1,len(samples)))
 runs.append(dict(id=name[:-4],kind='measured',dynamics='unforced_scalar_rotation',inertia=None,initialRate=samples[0]['rate'],source=dict(recordingId=protocol['revision']+'/'+name,label='Original author small-paper-baffle recording',sha256=hashlib.sha256(raw).hexdigest(),url='https://raw.githubusercontent.com/EnzeXu/Damped_Pendulum_Dataset/'+protocol['revision']+'/raw_data/'+name,license='Apache-2.0',transform='Original5–25s readings, no smoothing/recentering/resampling'),rateObservation=dict(unit='rad/s',basis='Original supplied PASCO column',dependence='not-assumed-independent'),samples=samples))
(p/('held-runs.json' if names==[protocol['held']] else 'training-runs.json')).write_text(json.dumps(runs))
