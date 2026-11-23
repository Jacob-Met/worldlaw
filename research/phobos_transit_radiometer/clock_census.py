import json,urllib.request,re,hashlib,xml.etree.ElementTree as ET,datetime as dt
events=json.loads("[[\"0096\",\"20190304_20190305\",\"2019-03-05T10:48:17\",26],[\"0097\",\"20190305_20190306\",\"2019-03-06T09:34:08\",28],[\"0099\",\"20190308_20190308\",\"2019-03-08T15:37:31\",23],[\"0498\",\"20200420_20200421\",\"2020-04-21T14:58:53\",36],[\"0499\",\"20200421_20200422\",\"2020-04-22T13:52:39\",28],[\"0501\",\"20200423_20200425\",\"2020-04-24T11:27:56\",27]]")
def get(u):
 with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Planetary archive event clock qualification'}),timeout=30) as r:return r.read()
def label(b):
 x=ET.fromstring(b);return [(n.findtext('{*}name'),n.findtext('{*}field_location'),n.findtext('{*}field_length'),n.findtext('{*}description'),n.findtext('{*}unit')) for n in x.findall('.//{*}Field_Character')]
for sol,dates,utc,width in events:
 base='https://pds-ppi.igpp.ucla.edu/data/insight-ifg-mars/data-sc-engineering/'+('SOL0090_SOL0119_20190226_20190329' if int(sol)<100 else 'SOL0480_SOL0509_20200402_20200503')+'/ancil_SOL'+sol+'_'+dates+'_v01.'
 try:
  b=get(base+'xml');fs=label(b)
  print(json.dumps({'sol':sol,'label_sha256':hashlib.sha256(b).hexdigest(),'roster':[f[0] for f in fs][:15],'clock_and_SAC':[[f[0],f[1],f[2],(f[3] or '')[:350],f[4]] for f in fs if re.search('UTC|E-0771|E-0791|solar array.*(1|2).*current',str(f),re.I)][:14]}))
  assert fs and any('UTC' in str(f[0]).upper() for f in fs)
  record=get(base+'tab');times=[]
  for line in record.splitlines():
   hit=re.search(rb'(20\d\d-(?:\d\d-\d\d|\d{3})T\d\d:\d\d:\d\d(?:\.\d+)?)',line[:180])
   if not hit:continue
   raw=hit.group(0).decode()
   try:t=dt.datetime.fromisoformat(raw)
   except ValueError:t=dt.datetime.strptime(raw,'%Y-%jT%H:%M:%S.%f' if '.' in raw else '%Y-%jT%H:%M:%S')
   sec=(t-dt.datetime.fromisoformat(utc)).total_seconds()
   if abs(sec)<=100:times.append(sec)
  print(json.dumps({'sol':sol,'duration_seconds':width,'original_tab_sha256':hashlib.sha256(record).hexdigest(),'all_row_utc_offsets_100s':times,'in_event_rows':sum(abs(t)<=width/2 for t in times),'scientific_values_used':0}))
 except (OSError,ValueError,AssertionError) as e:print(json.dumps({'sol':sol,'refusal':str(e)}))
