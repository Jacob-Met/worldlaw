"""Read only the stated columns of the public TRAIL3 orientation workbook."""
import io
import re
import zipfile
import hashlib
from xml.etree import ElementTree as ET

from mesh_geometry import ARCHIVE_SHA

NS={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def read_rows(raw):
    if hashlib.sha256(raw).hexdigest()!=ARCHIVE_SHA:raise ValueError('unexpected source archive')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        payload=archive.read('Data for repository/Aggregate orientation data.xlsx')
    with zipfile.ZipFile(io.BytesIO(payload)) as book:
        sheet=ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
        sst=ET.fromstring(book.read('xl/sharedStrings.xml'))
    columns=set('BCDE')
    selected={}
    for cell in sheet.findall('.//x:sheetData/x:row/x:c',NS):
        loc=cell.get('r')
        col=re.sub('[0-9]','',loc)
        row=int(loc[len(col):])
        if row<3 or col not in columns:continue
        v=cell.find('x:v',NS)
        if v is None:continue
        selected[loc]=''.join(sst[int(v.text)].itertext()).strip() if cell.get('t')=='s' else float(v.text)
    # Only explicit vertical A-D merge declarations propagate metadata.
    for merge in sheet.findall('.//x:mergeCell',NS):
        m=re.fullmatch(r'([BCD])(\d+):\1(\d+)',merge.get('ref'))
        if not m:continue
        col,start,stop=m.group(1),int(m.group(2)),int(m.group(3))
        if start<3 or col+str(start) not in selected:continue
        for index in range(start+1,stop+1):
            key=col+str(index)
            if key in selected:raise ValueError(('merged field conflict',key))
            selected[key]=selected[col+str(start)]
    rows=[]
    for index in range(3,131):
        def val(col):return selected[col+str(index)]
        row={'index':index,'name':val('B'),'ratios':[val('C'),val('D'),1.0],'re':val('E')}
        rows.append(row)
    if len(rows)!=128 or len({r['name'] for r in rows})!=20:raise ValueError('source cohort mismatch')
    return rows
