"""Inspect public inputs and measurement availability without decoding numerical endpoint cells."""
import argparse
from collections import Counter
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ARCHIVE_SHA='8beba1224c9a9e4e7d140028e6c4fd3cdcb1d304eeed0cdc4c6946116b449700'
WORKBOOK_SHA='337864c01b641e0d8da49f1c9e61d1163a6a43648455377b50686627d9fd28e3'
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
CUTS=(0,38880,60960,62400,63840,65230)
EXPECTED=('1 Samples and specimens','2 Mass and moisture content','3 Temperature difference',
          '4 Boundary conditions','App. A Sorption properties','App. B Moisture permeability')


def acquire():
    url='https://data.mendeley.com/public-api/zip/dbfdm6sy6x/download/1'
    headers={'User-Agent':'source-eligibility-research/1.0','Accept':'*/*'}
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers,method='HEAD'),timeout=90) as f:
        uri=f.geturl()
        if int(f.headers['Content-Length'])!=15230848:
            raise ValueError('Publisher archive size mismatch')
    headers['Range']='bytes=0-15230847'
    with urllib.request.urlopen(urllib.request.Request(uri,headers=headers),timeout=120) as f:
        if f.status!=206 or f.headers.get('Content-Range')!='bytes 0-15230847/15230848':
            raise ValueError('Incomplete public archive')
        return f.read(15230849)


def rows(book, sheet):
    with book.open(f'xl/worksheets/sheet{sheet}.xml') as f:
        for _,row in ET.iterparse(f,events=('end',)):
            if row.tag!=NS+'row':
                continue
            yield int(row.attrib['r']),{
                re.sub(r'\d+','',c.attrib['r']):c for c in row.findall(NS+'c')}
            row.clear()


def value(cell):
    return cell.findtext(NS+'v','') if cell is not None else ''


def source_audit(b):
    if hashlib.sha256(b).hexdigest()!=ARCHIVE_SHA:
        raise ValueError('Source archive hash mismatch')
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        names=[s for s in z.namelist() if s.endswith('.xlsx')]
        if len(names)!=1:
            raise ValueError('Expected one source workbook')
        body=z.read(names[0])
    if hashlib.sha256(body).hexdigest()!=WORKBOOK_SHA:
        raise ValueError('Workbook hash mismatch')
    with zipfile.ZipFile(io.BytesIO(body)) as book:
        wb=ET.fromstring(book.read('xl/workbook.xml'))
        names=tuple(s.attrib['name'] for s in wb.find(NS+'sheets'))
        assert names==EXPECTED
        strings=[''.join(e.text or '' for e in s.iter(NS+'t')) for s in ET.fromstring(book.read('xl/sharedStrings.xml'))]
        geometry={}
        for n,c in rows(book,1):
            if 9<=n<=16:
                name=strings[int(value(c['C']))]
                geometry[name]={k:float(value(c[k])) for k in 'DEFGHIJKL'}
        tags={};values={};scans=0;mass_refs=[]
        for n,c in rows(book,5):
            if n in (14,15):
                values[n]={k:value(c.get(k)) for k in 'FGHI' if value(c.get(k))}
            for k in ('K','V'):
                if n in (5,20,21) and k in c and c[k].get('t')=='s':
                    tags[k+str(n)]=strings[int(value(c[k]))]
            if n>23 and value(c.get('V')) and value(c.get('W')):
                scans+=1
            if n in range(55,65):
                for k in 'PQRST':
                    f=c.get(k)
                    if f is not None and '2 Mass and moisture content' in f.findtext(NS+'f',''):
                        mass_refs.append([k+str(n),f.findtext(NS+'f')])
        permp={}
        for n,c in rows(book,6):
            if n==5:tags['permeability']=strings[int(value(c['K']))]
            if n in (16,17,18):permp[n]={k:value(c[k]) for k in 'FGH'}
        temperatures=[];humidities=[];beta_steps=[];below=[]
        for n,c in rows(book,4):
            if n<12 or not value(c.get('B')):
                continue
            minute=int(value(c['B']))
            if minute!=len(temperatures):
                raise ValueError('Invalid contiguous input clock')
            t,h,beta=[float(value(c[k])) for k in 'DEF']
            temperatures.append(t);humidities.append(h)
            if not beta_steps or beta_steps[-1][1]!=beta:
                beta_steps.append([minute,beta])
            if h<.70:
                below.append(minute)
        counts=Counter();complete=Counter();missing=[];round_error=0
        minute_points=[]
        for n,c in rows(book,2):
            if n<9 or not value(c.get('B')):
                continue
            raw=float(value(c['B']));m=round(raw)
            round_error=max(round_error,abs(raw-m))
            if minute_points and m<=minute_points[-1]:
                raise ValueError('Observation clock is not strictly increasing')
            minute_points.append(m)
            block=next(i for i in range(5) if CUTS[i]<=m<CUTS[i+1])
            counts[block]+=1
            # Inspect the cell tag and presence of a value. Never convert the four
            # stored mass values or their derived moisture-content cells to numbers.
            absent=[k for k in 'DEFG' if not value(c.get(k)) or c[k].get('t') in ('s','e','str')]
            if absent:missing.append([m,absent])
            else:complete[block]+=1
    assert len(temperatures)==65230 and below==[9081,9082]
    assert len(mass_refs)==50 and scans==65230
    assert [counts[i] for i in range(5)]==[73,33,12,11,9]
    assert [complete[i] for i in range(5)]==[73,33,11,11,9]
    assert missing==[[61920,list('DEFG')]] and round_error<1e-7
    return {'archive_sha256':ARCHIVE_SHA,'workbook_sha256':WORKBOOK_SHA,'input_minute_count':len(temperatures),
            'time_range_minutes':[0,len(temperatures)-1],'mass_observation_minutes':minute_points,
            'temperature_range_c':[min(temperatures),max(temperatures)],
            'relative_humidity_range':[min(humidities),max(humidities)],'outside_relative_humidity_domain':below,
            'surface_coefficient_steps_minute_and_m_s':beta_steps,'dish_specimens':geometry,
            'mass_rounding_residual_minutes':round_error,'window_minute_boundaries':CUTS,
            'scheduled':[counts[i] for i in range(5)],'complete':[complete[i] for i in range(5)],
            'missing_minute_columns':missing,'source_wood_parameters':values,'permeability_parameters':permp,
            'target_linked_equilibrium_formula_references':mass_refs,'estimated_scanning_rows':scans,
            'source_lineage_labels':tags,'mass_values_used':False,'thermocouple_sheet_opened':False}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive',type=Path)
    args=parser.parse_args()
    source=args.archive.read_bytes() if args.archive else acquire()
    print(json.dumps(source_audit(source),sort_keys=True,indent=2))
