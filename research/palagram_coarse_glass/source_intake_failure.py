import hashlib, io, json, os, pathlib, tempfile, urllib.request, zipfile, re
root='https://zenodo.org/api/records/10854247'
def url(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'PALAGRAM scientific source inventory'}), timeout=100)
with url(root) as r: rec=json.load(r)
fs=rec['files']
assert len(fs)==1
f=fs[0]
with tempfile.TemporaryFile() as fp:
    h=hashlib.sha256(); m=hashlib.md5(); count=0
    with url(f['links']['content']) as r:
        while chunk:=r.read(1024*1024):
            fp.write(chunk); h.update(chunk); m.update(chunk); count+=len(chunk)
    assert count==f['size'] and 'md5:'+m.hexdigest()==f['checksum']=='md5:73cfae37efa5cc412998ce7046146399'
    z=zipfile.ZipFile(fp)
    members=z.infolist()
    documents={}
    for info in members:
        p=pathlib.PurePosixPath(info.filename)
        if p.name=='dataset_summary.csv':
            with z.open(info) as g: documents['summary_header']=g.readline(12000).decode()
        if p.name=='analysis.py' or p.name.lower() in ('readme.md','readme.rst'):
            bb=z.read(info)
            documents[str(p)]={'bytes':len(bb),'sha256':hashlib.sha256(bb).hexdigest()}
    def readgroup(part):
        return sorted([info.filename for info in members if '/'+part+'/' in info.filename and not info.is_dir()])
    mans=[(x.filename,x.file_size,x.CRC) for x in members]
    print(json.dumps({'doi':rec['doi'],'license':rec['metadata'].get('license') or rec['metadata'].get('rights'),'source_files':len(members),'archive_bytes':count,'archive_sha256':h.hexdigest(),'md5':m.hexdigest(),'census_sha256':hashlib.sha256(json.dumps(mans,separators=(',',':')).encode()).hexdigest(),'source_documents':documents,'input_names':readgroup('input_data'),'output_names':readgroup('output_data'),'code_names':[k.filename for k in members if k.filename.endswith(('.py','.tex','.ipynb'))],'scientific_array_reads':0,'summary_values_read':0},sort_keys=True))