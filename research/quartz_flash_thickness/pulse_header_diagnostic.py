"""Source/header-only localization of the unchanged forecast's exemplar refusal."""
from model import archive,split
with archive() as a:
 for m in a:
    if 'Sample_Laser_Voltage_1538_Filter_100.csv' in m.name:
        b=a.extractfile(m).read();h,ls=split(b)
        print('member',repr(m.name),m.isfile(),len(b),b[:6].hex())
        print('literal-fit-parser-settings',repr(h))
        if b.startswith((b'\xff\xfe',b'\xfe\xff')):b=b.decode('utf-16').encode('latin1','replace')
        print('specific-header-bytes',[repr(line) for line in b.splitlines() if line.lower().startswith((b'#sensor;',b'#laser_voltage/v;',b'#laser_filter/mm;',b'#time/ms;'))][:12])
        print('numeric_response_cells_read',0)
