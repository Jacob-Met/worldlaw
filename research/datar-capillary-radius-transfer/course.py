"""Prospective Datar microcapillary speed transfer. Python 3, no third-party packages."""
import hashlib
import json
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
SHA = 'd805c0bcf02de00231635aa999c41416dcdd35a5632fd2507dc350ce63ff3d88'
MATERIALS = ['0.3% Agarose++','0.5% Agarose++','0.7% Agarose++','1% Agarose++','2% Agarose++','0.5% Agarose']
BULK = [5.2, 12.9, 4.3, 1.09, 0.92, 65.0]  # 10^-16 m^2, gravimetric reference from Table 1
NAMES = ['mixed','author_radius','layer','constant','nearest','power','shrunk','author_bulk']
def encode(x):
    return json.dumps(x,sort_keys=True,separators=(',',':'),allow_nan=False).encode()

def census(path):
    assert hashlib.sha256(path.read_bytes()).hexdigest()==SHA
    result=[]
    with ZipFile(path) as archive:
        wb=ET.fromstring(archive.read('xl/workbook.xml'))
        assert [x.get('name') for x in wb.findall('s:sheets/s:sheet', NS)]==MATERIALS
        for index,name in enumerate(MATERIALS,1):
            if index==5:
                continue
            xml=ET.fromstring(archive.read(f'xl/worksheets/sheet{index}.xml'))
            date=None
            for row in xml.findall('.//s:row',NS):
                rowno=int(row.attrib['r'])
                cell={}
                for c in row.findall('s:c',NS):
                    col=c.get('r').removesuffix(str(rowno))
                    if c.get('t')!='s' and c.find('s:v',NS) is not None:
                        cell[col]=c
                if 'A' in cell:
                    date=cell['A'].findtext('s:v',namespaces=NS)
                if 'B' not in cell or 'D' not in cell:
                    continue
                assert date and len(date)==8
                result.append(dict(g=index-1,row=rowno,date=date,
                    R=float(cell['B'].findtext('s:v',namespaces=NS)),
                    sd_R=float(cell['C'].findtext('s:v',namespaces=NS)),speed=cell['D'],sd_speed=cell['E']))
    assert len(result)==31
    return result

def read_positive(cell):
    y=float(cell.findtext('s:v',namespaces=NS))
    if not math.isfinite(y) or y<=0:
        raise ValueError('nonpositive or invalid observed log-speed input')
    return y

def term(method,r,parameter):
    if method=='mixed':
        return -math.log((1-parameter)*r*r+parameter*r)
    if method=='author_radius':
        return -2*math.log(r)
    if method=='layer':
        return -math.log(r)
    if method in ('shrunk','power'):
        return parameter*math.log(r)
    return 0.0

def coefficient(rows,method,par):
    return statistics.mean(math.log(x['u'])-term(method,x['R']/2e-5,par) for x in rows)

def equalgroup_loss(rows,method,par):
    losses=[]
    for g in sorted({x['g'] for x in rows}):
        group=[x for x in rows if x['g']==g]
        a=coefficient(group,method,par)
        losses.append(statistics.mean((math.log(x['u'])-a-term(method,x['R']/2e-5,par))**2 for x in group))
    return statistics.mean(losses)

def fit(rows):
    return dict(mixed=min((i/200 for i in range(201)),key=lambda p:equalgroup_loss(rows,'mixed',p)),
                power=min((i/50 for i in range(-200,201)),key=lambda p:equalgroup_loss(rows,'power',p)))

def predict(rows,x,parameters):
    r=x['R']/2e-5
    g=x['g']
    group=[v for v in rows if v['g']==g]
    lx=[math.log(v['R']/2e-5) for v in group]
    ly=[math.log(v['u']) for v in group]
    xm,ym=statistics.mean(lx),statistics.mean(ly)
    slope=(sum((u-xm)*(v-ym) for u,v in zip(lx,ly))-.08)/(sum((u-xm)**2 for u in lx)+.04)
    p={**parameters,'shrunk':min(4,max(-4,slope))}
    forecasts={m:math.exp(coefficient(group,m,p.get(m,0))+term(m,r,p.get(m,0))) for m in NAMES if m not in ('nearest','author_bulk')}
    forecasts['nearest']=min(group,key=lambda z:(abs(math.log(z['R']/x['R'])),z['row']))['u']
    gamma,eta,angle=(.05,.00112,58.2) if g==5 else (.04,.00196,53.8)
    forecasts['author_bulk']=2*BULK[g]*1e-16*gamma*math.cos(math.radians(angle))/(eta*x['R']**2)
    return forecasts

def public(x):
    return {k:v for k,v in x.items() if k not in ('speed','sd_speed')}

def main(book,out,mode):
    rows=census(book)
    first={g:min(x['date'] for x in rows if x['g']==g) for g in {x['g'] for x in rows}}
    train=[x for x in rows if x['date']==first[x['g']]]
    held=[x for x in rows if x['date']!=first[x['g']]]
    assert len(train)==11 and len(held)==20 and len({(x['g'],x['date']) for x in held})==6
    for x in train:
        x['u']=read_positive(x['speed'])
    params=fit(train)
    forecasts=[{**public(x),'forecast':predict(train,x,params)} for x in held]
    diagnostic=[]
    for x in train:
        remaining=[z for z in train if z is not x]
        if any(z['g']==x['g'] for z in remaining):
            diagnostic.append({**public(x),'forecast':predict(remaining,x,fit(remaining))})
    prior={'parameters':params,'train':[public(x) for x in train],'train_leave_one_tip':diagnostic,'forecasts':forecasts}
    locked=out/'forecast.json'
    if mode=='forecast':
        with locked.open('xb') as f:
            f.write(encode(prior))
        print('FORECAST',hashlib.sha256(locked.read_bytes()).hexdigest(),locked)
        print('TRAIN',encode({'parameters':params,'rows':diagnostic,'forecasts':forecasts}).decode())
        return
    if mode!='score':
        raise ValueError('mode')
    assert locked.read_bytes()==encode(prior)
    assert hashlib.sha256(locked.read_bytes()).hexdigest()==sys.argv[4]  # external committed digest
    scored=[]
    for x,z in zip(held,forecasts):
        scored.append({**z,'speed_m_s':read_positive(x['speed']),'fit_error_m_s':float(x['sd_speed'].findtext('s:v',namespaces=NS))})
    def errors(row,name):
        return math.log(row['forecast'][name]/row['speed_m_s'])
    scores={};by_group={}
    for method in NAMES:
        blocks=defaultdict(list)
        for z in scored:blocks[(z['g'],z['date'])].append(errors(z,method)**2)
        groups=defaultdict(list)
        for (g,date),vv in blocks.items():groups[g].append(statistics.mean(vv))
        by_group[method]={g:math.sqrt(statistics.mean(vv)) for g,vv in groups.items()}
        scores[method]=math.sqrt(statistics.mean(v*v for v in by_group[method].values()))
    best=min(NAMES[1:],key=scores.get)
    def worst(method):return max(abs(errors(z,method)) for z in scored)
    gates={'coverage':len(scored)==20,'mean_gain':scores['mixed']<=.95*scores[best],
           'group_wins':sum(v<by_group[best][g] for g,v in by_group['mixed'].items())>=4,
           'worst_guard':worst('mixed')<=1.05*worst(best)}
    report={'forecast_sha':hashlib.sha256(locked.read_bytes()).hexdigest(),'parameters':params,
            'scores':scores,'group_rms':by_group,'strongest':best,'gates':gates,'rows':scored,
            'worst_log_abs':{m:worst(m) for m in NAMES}}
    (out/'scores.json').write_bytes(encode(report))
    print('RESULT',encode(report).decode())

if __name__=='__main__':
    main(Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3])
