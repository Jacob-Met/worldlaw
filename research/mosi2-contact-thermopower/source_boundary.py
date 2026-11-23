"""Verify the authors' supplement and project only the admitted methods and geometry metadata."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
from urllib.request import urlopen


def verify(supplement, archive):
    assert hashlib.sha256(supplement.read_bytes()).hexdigest() == '5037001d75310809c60ddfb99cb7aabf524b03ccb28f7ce50014e44797e1b159'
    assert hashlib.sha256(archive).hexdigest() == 'dcda90faa2e3e7366205d2a3510f761247dde59bdb08f3d87b59a1a438085126'
    with tarfile.open(fileobj=io.BytesIO(archive)) as src:
        tex = ' '.join(src.extractfile('sakamoto.tex').read().decode().split()).lower()
    phrases = ['two relay configurations were measured separately', 'on the same crystal',
               'gold leads','low-contact-resistance copper clips','robin boundary condition',
               'available from the authors upon reasonable request']
    assert all(p in tex for p in phrases)
    # S1 is the electrical experiment's input thermal profile; S2 locates contacts.
    # The raw S3 voltage sheet and S4–S6 thermal-response images are excluded.
    pages = subprocess.check_output(['pdftotext','-f','2','-l','3',
                                     str(supplement),'-']).decode().lower()
    text = ' '.join(pages.split())
    assert 'uncovered' in text and 'excluded from the temperature analysis' in text
    assert 'terminal 0 is used as the reference point' in text
    return {'author_archive_bytes':len(archive),'supplement_bytes':supplement.stat().st_size,
            'geometry_contacts':8,'quantitative_upper_surface_calibration':'elongated tape strip',
            'voltage_table_opened':False,'peltier_response_images_opened':False}


if __name__=='__main__':
    import tempfile
    if len(sys.argv)==3:
        path=Path(sys.argv[1]);raw=Path(sys.argv[2]).read_bytes()
        print(json.dumps(verify(path,raw),sort_keys=True))
    else:
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'supple2.pdf'
            path.write_bytes(urlopen('https://ndownloader.figshare.com/files/70779849',timeout=60).read())
            raw=urlopen('https://arxiv.org/src/2610.38506',timeout=60).read()
            print(json.dumps(verify(path,raw),sort_keys=True))
