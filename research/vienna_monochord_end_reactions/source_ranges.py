"""Recover the two published range segments and the individually verified stroke roster."""
import hashlib,json,urllib.request
from pathlib import Path
import sys
def main(target):
    target.mkdir(parents=True,exist_ok=True)
    rec=json.load(urllib.request.urlopen('https://zenodo.org/api/records/17749111',timeout=45))
    entry,=[f for f in rec['files'] if f['key']=='2024-03-25_TypeA_sample1.7z']
    total=14083546513
    assert entry['size']==total and entry['checksum']=='md5:2709034cc10344f37f3488376ae3ebcd'
    start=32
    for name,size,digest in [('original-packed-prefix.bin',134217728,'49dd832cc1fd8f411b79aa18aae49b7c0853192acafa8d77458889c6269b546f'),('original-packed-suffix-to-index56.bin',16777216,'e6ea6615a5941fdfe85d57dce21d4dca791240599e492f8bfb235ac6c829ee9b')]:
        dest=target/name
        if dest.exists():
            with dest.open('rb') as f:assert dest.stat().st_size==size and hashlib.file_digest(f,'sha256').hexdigest()==digest
        else:
            temp=dest.with_suffix('.partial')
            with temp.open('xb') as out:
                for i in range(0,size,4*2**20):
                    a=start+i;b=min(start+size,a+4*2**20)-1
                    req=urllib.request.Request(entry['links']['self'],headers={'User-Agent':'public cello archive receiver','Range':f'bytes={a}-{b}','Accept-Encoding':'identity'})
                    with urllib.request.urlopen(req,timeout=90) as r:
                        assert r.status==206 and r.headers['Content-Range']==f'bytes {a}-{b}/{total}'
                        data=r.read(b-a+2);assert len(data)==b-a+1;out.write(data)
            with temp.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==digest
            temp.rename(dest)
        start+=size
    for name in ('catalog.json','design-roster.json'):
        b=Path(__file__).with_name(name).read_bytes()
        if (target/name).exists():assert (target/name).read_bytes()==b
        else:(target/name).write_bytes(b)
    print('Verified two compressed segments totalling 150994944 bytes. Whole-source MD5 is supplied by publisher and has not been recomputed.')
if __name__=='__main__':main(Path(sys.argv[1]))
