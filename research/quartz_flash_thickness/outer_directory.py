"""Verify the native TAR layout and exact inner ZIP without opening a measurement column."""
from model import archive,split,sha
import io,zipfile
with archive() as outer:
 for m in outer:
    if not m.isfile():continue
    b=outer.extractfile(m).read()
    print('TAR_MEMBER',m.name,len(b),sha(b))
    if zipfile.is_zipfile(io.BytesIO(b)):
        with zipfile.ZipFile(io.BytesIO(b)) as inner:
            names=inner.namelist(); print('INNER_COUNTS',len(names),sum(n.endswith('.csv') for n in names))
            hits=[n for n in names if n.endswith('Sample_Laser_Voltage_1538_Filter_100.csv')]
            assert len(hits)==1
            bb=inner.read(hits[0]);h,ls=split(bb)
            print('PULSE_HEADER',hits[0],sha(bb),repr(h))
print('QUARANTINE no scientific measurement rows decoded')
