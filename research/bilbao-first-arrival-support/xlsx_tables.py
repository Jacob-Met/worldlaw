"""Read named worksheet columns without evaluating formulas or opening unrelated tables."""
import io
import re
import zipfile
from xml.etree import ElementTree as ET

TAG = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def columns(blob, wanted):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            shared = [''.join(t.text or '' for t in item.iter(TAG+'t'))
                      for item in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(TAG+'si')]
        def value(c):
            if c.get('t')=='inlineStr':
                return ''.join(t.text or '' for t in c.iter(TAG+'t'))
            v=c.find(TAG+'v')
            if v is None or v.text is None:return None
            if c.get('t')=='s':return shared[int(v.text)]
            return v.text
        header={};rows=[]
        with z.open('xl/worksheets/sheet1.xml') as stream:
            for _,row in ET.iterparse(stream,events=('end',)):
                if row.tag!=TAG+'row':continue
                content={}
                if not header:
                    for c in row.findall(TAG+'c'):
                        header[re.match('[A-Z]+',c.get('r')).group()]=value(c)
                    absent=set(wanted)-set(header.values())
                    if absent:raise ValueError('Missing worksheet columns '+repr(sorted(absent)))
                else:
                    for c in row.findall(TAG+'c'):
                        k=header.get(re.match('[A-Z]+',c.get('r')).group())
                        if k in wanted:content[k]=value(c)
                    if any(v not in (None,'') for v in content.values()):rows.append(content)
                row.clear()
    return rows
