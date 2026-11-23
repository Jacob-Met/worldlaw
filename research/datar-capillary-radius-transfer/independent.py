"""Recount the fixed transfer using Decimal log arithmetic and independently parsed source rows."""
import argparse
from collections import defaultdict
from decimal import Decimal as D, localcontext
from hashlib import sha256
import json
from pathlib import Path
from statistics import mean
import xml.etree.ElementTree as XML
from zipfile import ZipFile

SOURCE = 'd805c0bcf02de00231635aa999c41416dcdd35a5632fd2507dc350ce63ff3d88'
SCORES = 'ec3f78cee0cb335346274ab5c654736919644cc1eb71ada3cbffc68644737bbf'
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def cohort_rows(path):
    assert sha256(path.read_bytes()).hexdigest()==SOURCE
    groups = {}
    with ZipFile(path) as z:
        for i in (0,1,2,3,5):
            sheet=XML.fromstring(z.read('xl/worksheets/sheet%d.xml'%(i+1)))
            records=[];date=None
            for row in sheet.iter(NS+'row'):
                n=int(row.get('r'))
                if n<3:continue
                def val(column):
                    c=row.find(f"{NS}c[@r='{column}{n}']/{NS}v")
                    return None if c is None else c.text
                if val('A') is not None:date=val('A')
                if val('B') is None or val('D') is None:continue
                records.append((date,n,D(val('B')),D(val('C')),D(val('D')),D(val('E'))))
            groups[i]=records
    return groups

def check(book,summary):
    assert sha256(summary.read_bytes()).hexdigest()==SCORES
    data=json.loads(summary.read_text(),parse_float=D)
    groups=cohort_rows(book)
    first={g:min(r[0] for r in rows) for g,rows in groups.items()}
    tr={g:[r for r in rows if r[0]==first[g]] for g,rows in groups.items()}
    val={(g,r[1]):r for g,rows in groups.items() for r in rows if r[0]!=first[g]}
    assert [len(v) for v in tr.values()]==[2,4,2,2,1] and len(val)==20
    lr=lambda r: (r/D('.00002')).ln()
    rr={g:[(lr(r[2]),r[4].ln()) for r in rows] for g,rows in tr.items()}
    def offset(x,par,method):
        if method=='mixed':
            return -x-((1-par)*x.exp()+par).ln()
        return par*x
    def centers(par,method):
        return {g:mean(u-offset(x,par,method) for x,u in rows) for g,rows in rr.items()}
    def fit(par,method):
        center=centers(par,method)
        return mean(mean((u-center[g]-offset(x,par,method))**2 for x,u in rows) for g,rows in rr.items())
    w=min((D(i)/200 for i in range(201)),key=lambda z:fit(z,'mixed'))
    p=min((D(i)/50 for i in range(-200,201)),key=lambda z:fit(z,'power'))
    assert w==data['parameters']['mixed'] and p==data['parameters']['power']
    errs=defaultdict(lambda:defaultdict(lambda:defaultdict(list)))
    max_relative=D(0)
    for row in data['rows']:
        g=row['g']
        date,n,R,sR,U,sU=val.pop((g,row['row']))
        assert date==row['date']
        # The producer serialized binary64 values; Decimal retains the XML precision for the scientific reconstruction.
        assert all(float(source).hex()==float(recorded).hex() for source,recorded in
                   zip((R,sR,U,sU),(row['R'],row['sd_R'],row['speed_m_s'],row['fit_error_m_s'])))
        xt=lr(R);xs,ys=zip(*rr[g]);xm,ym=mean(xs),mean(ys)
        shrink=max(D(-4),min(D(4),(sum((x-xm)*(y-ym) for x,y in rr[g])-D('.08'))/(sum((x-xm)**2 for x in xs)+D('.04'))))
        definitions={'mixed':w,'power':p,'author_radius':D(-2),'constant':D(0),'layer':D(-1),'shrunk':shrink}
        prediction={}
        for name,par in definitions.items():
            a=mean(u-offset(x,par,name) for x,u in rr[g])
            prediction[name]=(a+offset(xt,par,name)).exp()
        prediction['nearest']=min(tr[g],key=lambda r:(abs(lr(r[2])-xt),r[1]))[4]
        # Cosines of the two published mean static angles; computed with a separate Taylor expansion.
        pi=D('3.1415926535897932384626433832795028841971693993751')
        ang=D('58.2' if g==5 else '53.8')*pi/D(180)
        cosine=term=D(1)
        for j in range(1,30):
            term*= -ang**2/((2*j-1)*(2*j));cosine+=term
        k=D(['5.2','12.9','4.3','1.09','.92','65'][g])*D('1e-16')
        prediction['author_bulk']=2*k*D('.05' if g==5 else '.04')*cosine/(D('.00112' if g==5 else '.00196')*R**2)
        for name,u in prediction.items():
            max_relative=max(max_relative,abs(u/row['forecast'][name]-1))
            errs[name][g][date].append((u/U).ln())
    assert not val and max_relative<D('1e-12')
    scores={};cg={};worst={}
    for name,groups_ in errs.items():
        cg[name]={str(g):mean(mean(e*e for e in v) for v in dates.values()).sqrt() for g,dates in groups_.items()}
        scores[name]=mean(v*v for v in cg[name].values()).sqrt()
        worst[name]=max(abs(e) for dates in groups_.values() for v in dates.values() for e in v)
    for name,m in scores.items():
        assert abs(m-data['scores'][name])<D('1e-12')
        assert abs(worst[name]-data['worst_log_abs'][name])<D('1e-12')
        assert all(abs(v-data['group_rms'][name][g])<D('1e-12') for g,v in cg[name].items())
    b=min((x for x in scores if x!='mixed'),key=scores.get)
    decisions={'coverage':True,'mean_gain':scores['mixed']<=D('.95')*scores[b],
               'group_wins':sum(v<cg[b][g] for g,v in cg['mixed'].items())>=4,
               'worst_guard':worst['mixed']<=D('1.05')*worst[b]}
    assert decisions==data['gates'] and b==data['strongest']
    return dict(forecasts=160,held_tips=20,material_date_blocks=6,
                max_relative_forecast_difference=str(max_relative),gates=decisions,
                source=SOURCE, locked_forecast=data['forecast_sha'])
if __name__=='__main__':
    cli=argparse.ArgumentParser()
    cli.add_argument('workbook',type=Path)
    cli.add_argument('scores',type=Path)
    args=cli.parse_args()
    with localcontext() as ctx:
        ctx.prec=46
        print(json.dumps(check(args.workbook,args.scores),sort_keys=True))
