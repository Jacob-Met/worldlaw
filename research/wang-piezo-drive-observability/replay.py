"""Authenticate Wang et al. v9 and reproduce its voltage/displacement pairing qualification."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import Request,urlopen

from independent import check
from qualify import SOURCE_SHA,run


def author_archive(path):
    if not path.exists():
        url='https://data.mendeley.com/public-api/datasets/kzf668wggx/files?folder_id=root&version=9'
        with urlopen(Request(url,headers={'User-Agent':'Reproduce Wang v9 measurement qualification'}),timeout=60) as r:
            response=json.load(r)
        entries=response if isinstance(response,list) else response.get('files',response.get('data',[]))
        assert len(entries)==1
        entry=entries[0];details=entry['content_details']
        assert entry['id']=='97f1c2af-4ceb-4570-a173-abaad91ba6f9' and details['sha256_hash']==SOURCE_SHA
        temporary=path.with_suffix('.part')
        request=Request(details['download_url'],headers={'User-Agent':'Published piezoelectric response archive, schema only'})
        with urlopen(request,timeout=120) as source,temporary.open('wb') as target:
            while chunk:=source.read(1<<20):target.write(chunk)
        if temporary.stat().st_size!=98478148 or hashlib.sha256(temporary.read_bytes()).hexdigest()!=SOURCE_SHA:
            raise ValueError('Downloaded source differs from the registered v9 object')
        temporary.replace(path)
    assert path.stat().st_size==98478148 and hashlib.sha256(path.read_bytes()).hexdigest()==SOURCE_SHA
    return path


def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('work',type=Path);ap.add_argument('--archive',type=Path)
    a=ap.parse_args();work=a.work.resolve();work.mkdir(parents=True,exist_ok=True)
    path=author_archive((a.archive or work/'Wang-v9-Dataset.zip').resolve())
    observed=work/'qualified-no-output.json'
    run(path,observed)
    # Compare parsed JSON so the byte representation of an integer histogram key is immaterial.
    ref=json.loads(Path(__file__).with_name('observed.json').read_text())
    assert json.loads(observed.read_text())==ref['observed'],'Original source qualification differs'
    result=check(path,observed)
    assert result==ref['independent'],'Independent clock or matrix recount differs'
    assert result['complete_position_rows_unopened']==18373080
    print('VERIFIED',result['complete_position_rows_unopened'],'time/position rows; five acquisition clocks; three author maps; two identification programs')
    print('Synchronized experimental driver and reset not established. No position scores computed.')


if __name__=='__main__':main()
