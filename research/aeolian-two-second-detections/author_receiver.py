"""Compare published source-date minute activity against the original count samples."""
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

import numpy as np


def allowed_source_rows(book, sheet, date, daily_epoch):
    rows = {}
    # Read the two allowed source sheets only. Test-date numerical outcomes are
    # never interpreted. Only the lexical A/date value is inspected before a row
    # can reach XML text-to-number conversion for the published output columns.
    with zipfile.ZipFile(book) as z, z.open(f'xl/worksheets/sheet{sheet}.xml') as src:
        buffer=b''
        while chunk:=src.read(8192):
            buffer+=chunk
            while (end:=buffer.find(b'</row>'))>=0:
                row,buffer=buffer[:end+6],buffer[end+6:]
                start=row.find(b'<row ');row=row[start:]
                m=re.search(rb'<c\b[^>]*\br="A\d+"[^>]*>\s*<v>([^<]+)</v>',row)
                if not m:continue
                try: dnum=float(m[1])
                except ValueError:continue
                if round(dnum)!=daily_epoch:continue
                parsed=ET.fromstring(b'<row>'+row.split(b'>',1)[1]);values={}
                for cell in parsed:
                    val=cell.find('v');col=re.match(r'[A-Z]+',cell.get('r','')).group()
                    if val is not None and cell.get('t')!='s':values[col]=float(val.text)
                if all(k in values for k in ('B','C','D')):
                    st=int(round(values['B']*86400))%86400
                    en=int(round(values['C']*86400))%86400
                    if en-st==60:rows[st]=(values['D'],values.get('E'))
    return rows


def main():
    import argparse
    p=argparse.ArgumentParser();p.add_argument('features',type=Path);p.add_argument('raw',type=Path);p.add_argument('book',type=Path);p.add_argument('out',type=Path);a=p.parse_args()
    assert hashlib.sha256(a.book.read_bytes()).hexdigest()=='31f085272ec859fb52d6cfdf066fbbada3b1ca6985339a829704615df29d6b0f'
    results=[]
    for site,sheet,date in [('Jericoacoara',1,'20141113'),('RanchoGuadalupe',2,'20150323')]:
        day=(datetime.strptime(date,'%Y%m%d')-datetime(1899,12,30)).days
        expected=allowed_source_rows(a.book,sheet,date,day)
        for path in sorted(a.features.glob(f'{site}_{date}_*.npz')):
            with np.load(path) as data:counts=data['counts'].reshape(30,30)
            beg=path.stem.split('_')[2];start=int(beg[:2])*3600+int(beg[2:])*60
            wp=next(a.raw.glob(path.stem+'_Wind_U1_z*mm.txt'))
            table=np.loadtxt(wp,delimiter=',',skiprows=1)
            pos=(table[:,0]*3600+table[:,1]*60+table[:,2]-start)*25.
            ticks=np.rint(pos).astype(int)
            good=(np.abs(pos-ticks)<2e-5)&(ticks>=0)&(ticks<45000)
            keys,occ=np.unique(ticks[good],return_counts=True)
            good &= ~np.isin(ticks,keys[occ>1])
            raw=np.full((45000,3),np.nan);raw[ticks[good]]=table[good,3:6]
            mean=np.nanmean(raw,axis=0);axis=mean/np.linalg.norm(mean)
            u=(raw@axis).reshape(30,30,50).mean(axis=2)
            for m,cs in enumerate(counts):
                t=start+60*m
                if t not in expected or not np.isfinite(cs).all():continue
                fd=float(np.mean(cs>0));lam=float(cs[cs>0].mean()) if fd else 0.
                fq=0. if not fd else min(1.,float(fd/-np.expm1(-lam)))
                ref,uth=expected[t];q=None if fq in (0,1) or not np.isfinite(u[m]).all() else float(np.quantile(u[m],1-fq,method='hazen'))
                results.append(dict(site=site,block=path.stem,minute=m,f_D=fd,f_Q=fq,actual=ref,u_th=q,auth_u_th=uth))
        print('SOURCE',site,len(expected),'matched',sum(r['site']==site for r in results),flush=True)
    if not results: raise ValueError('no author minutes join by date and clock')
    out={'workbook':'31f085272ec859fb52d6cfdf066fbbada3b1ca6985339a829704615df29d6b0f','source_minutes':results,'reserve_worksheet_opened':False}
    errs=sorted(results,key=lambda r:abs(r['f_Q']-r['actual']),reverse=True);dif=[r['u_th']-r['auth_u_th'] for r in results if r['u_th'] is not None and r['auth_u_th'] is not None and np.isfinite(r['auth_u_th']) and np.isfinite(r['u_th'])]
    out['measurement']={'matches':len(results),'max_abs_fq':abs(errs[0]['f_Q']-errs[0]['actual']),'mae_fq':float(np.mean([abs(r['f_Q']-r['actual']) for r in results])),
        'measured_u_count':len(dif),'u_mae_m_s':float(np.mean(abs(np.array(dif)))) if dif else None,'u_max_m_s':float(np.max(abs(np.array(dif)))) if dif else None,'worst':errs[:3]}
    path=a.out/'author-source-minute-reconstruction.json';path.write_text(json.dumps(out,indent=2)+'\n');print('AUTHOR',json.dumps(out['measurement']));print('COMPLETE',hashlib.sha256(path.read_bytes()).hexdigest(),path)
if __name__=='__main__':main()
