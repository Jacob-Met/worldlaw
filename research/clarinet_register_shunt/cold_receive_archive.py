"""Cold receive the actual producer forecast from its immutable Git shards."""
import argparse,hashlib,io,json,pathlib,subprocess,tempfile,zipfile,struct,ast
REPO="https://github.com/Jacob-Met/gpu-jobs.git"
COMMIT="52d9d657e2bbfd1b812661a46ea8bfdcfee5b1b4"
PREFIX="research/f747_p3_session/clarinet-3556368d-forecast/"
def main():
    where=pathlib.Path(tempfile.mkdtemp(prefix="clarinet-cold-git-"))
    def git(*a):return subprocess.check_output(["git","-C",str(where),*a])
    git("init","-q");git("fetch","--filter=blob:none","--depth=1","-q",REPO,COMMIT)
    assert git("rev-parse","FETCH_HEAD").decode().strip()==COMMIT
    m=json.loads(git("show",COMMIT+":"+PREFIX+"manifest.json"))
    lock=json.load(open("forecast-lock.json"))
    assert m["archive_sha256"]==lock["archive_sha"] and m["archive_bytes"]==lock["archive_bytes"]
    stream=io.BytesIO()
    for i,p in enumerate(m["parts"]):
        assert i==p["index"] and p["name"]=="part-%02d.bin"%i
        b=git("show",COMMIT+":"+PREFIX+p["name"])
        assert hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()==p["blob"]
        assert hashlib.sha256(b).hexdigest()==p["sha256"] and len(b)==p["bytes"]
        stream.write(b)
    asset=stream.getvalue();assert len(asset)==lock["archive_bytes"] and hashlib.sha256(asset).hexdigest()==lock["archive_sha"]
    with zipfile.ZipFile(io.BytesIO(asset)) as z:
        f=io.BytesIO(z.read("predictions.npy"))
    assert f.read(8)==b"\x93NUMPY\x01\x00"
    desc=ast.literal_eval(f.read(int.from_bytes(f.read(2),"little")).decode().strip());assert desc==dict(descr="<c8",fortran_order=False,shape=(9,19501,3,3))
    raw=f.read()
    checks=0
    for role in range(9):
        for u in range(3):
            for l in range(3):
                h=hashlib.sha256()
                for k in range(19501):
                    off=8*((role*19501+k)*9+3*u+l);h.update(raw[off:off+8])
                assert h.hexdigest()==lock["digests"][f"{role}/{u+1}/{2*l+2}"];checks+=1
    print(json.dumps(dict(archive_bytes=len(asset),archive_sha=lock["archive_sha"],part_blobs=len(m["parts"]),all_field_vectors=checks,source_commit=COMMIT),sort_keys=True))
if __name__=="__main__":main()
