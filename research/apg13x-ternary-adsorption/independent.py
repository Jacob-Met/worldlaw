"""Scalar independent recount from full source rows, with archive identity checks."""
import hashlib,json,math,re,subprocess,sys,zipfile
from pathlib import Path
from statistics import fmean
PDF='b3434079b37233fef3c8ea656a0e011d46f5ce7559d7893631a9c0c5cabce9b3'
LOCK='43d441c0fbd08ae989e4edba9ab84f9d8c7a7d2adef1351630d8b1bc55fb3f0b'
SCORE='fff782a701c986c8dd175de670dbfa49d1b3d20fc7a64bd6313569c8e1deee60'
def read(pdf,fore,score):
    for p,h in [(pdf,PDF),(fore,LOCK),(score,SCORE)]:assert hashlib.sha256(p.read_bytes()).hexdigest()==h
    with zipfile.ZipFile(fore) as z:
        a=json.loads(z.read('predictions.json'));s=json.loads(z.read('source-diagnostics.json'))
    b=json.loads(score.read_bytes())
    txt=subprocess.check_output(['pdftotext','-f','67','-l','67','-layout',str(pdf),'-']).decode()
    cases=[]
    for line in txt.splitlines():
        v=line.split()
        if len(v)==11 and v[0] in ('273','303','333'):v=v[1:]
        if len(v)!=10:continue
        try:p,*v=map(float,v)
        except ValueError:continue
        if 75<=p<=930:cases.append([p,v[::3],v[1::3],v[2::3]])
    assert len(cases)==27,len(cases)
    diffs=[];names=a['arms'];errors=[[] for n in names];intervals=[[],[]]
    for i,((p,y,q,u),r) in enumerate(zip(cases,a['forecasts'])):
        assert p==r['row']['P'] and y==r['row']['y'] and q==b['observed'][i] and u==b['reported_uncertainties'][i]
        for k,pred in enumerate(r['predictions']):
            for g in range(3):
                err=pred[g]-q[g]
                diffs.append(abs(err-b['signed_residuals'][i][k][g]));errors[k].append(abs(err))
        band=s['calibration_bands'][str(r['row']['T'])]['author_band_halfwidth']
        for g in range(3):
            for k,(l,h) in enumerate([(r['lo'][g],r['hi'][g]),(r['predictions'][1][g]-band[g],r['predictions'][1][g]+band[g])]):
                intervals[k].append((l<=q[g]<=h,h-l,max(l-q[g],q[g]-h,0.)))
    metrics=[]
    for name,v in zip(names,errors):
        blocks=[fmean(v[i:i+9]) for i in range(0,81,9)]
        m,w=fmean(blocks),max(blocks);d=b['arms'][name]
        diffs.extend(abs(i-j) for i,j in zip(blocks,d['block_maes']))
        diffs.extend([abs(m-d['equal_block_mean']),abs(w-d['worst_block'])])
        k=v.index(max(v));assert d['worst']['row']['row']==k//3 and d['worst']['gas']==['CH4','N2','CO2'][k%3]
        metrics.append((m,w))
    for k in range(1,7):
        assert b['gates'][names[k]]==dict(mean=metrics[0][0]<metrics[k][0],worst=metrics[0][1]<metrics[k][1])
    assert b['primary_passed']==all(all(t.values()) for t in b['gates'].values())
    for name,cells in zip(['site','author'],intervals):
        e=b['intervals'][name];assert e['hits']==sum(h for h,w,d in cells)
        assert e['all_nine_per_block']==[all(h for h,w,d in cells[i:i+9]) for i in range(0,81,9)]
        diffs.extend([abs(fmean(w for h,w,d in cells)-e['mean_width']),abs(max(d for h,w,d in cells)-e['largest_outside_distance'])])
    assert max(diffs)<1e-12
    return dict(cases=27,components=81,signed_errors=567,conditions_scored=63,point_gates=12,primary=b['primary_passed'],interval_cells=162,maximum_numeric_difference=max(diffs),source_sha256=PDF,forecast_sha256=LOCK,score_sha256=SCORE,worst=b['arms'][names[0]]['worst'])
if __name__=='__main__':
    out=read(*map(Path,sys.argv[1:]));Path('independent.json').write_text(json.dumps(out,sort_keys=True));print('INDEPENDENT',json.dumps(out,sort_keys=True))
