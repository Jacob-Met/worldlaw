"""Inspect free-standing Git LFS pointers and one source-single WAV header."""
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import urllib.request

PIN = 'd9d55a600210e40e6531d4b74891771c0a9a3718'
REPO = 'ZulfadhliM/electric-guitar-samples'
TREE = 'f1ca8107172aafa4da05369250c7457766a221db'


def run():
    with tempfile.TemporaryDirectory() as temp:
        env = dict(os.environ, GIT_LFS_SKIP_SMUDGE='1')
        def git(*args):
            return subprocess.check_output(['git', *args], cwd=temp, env=env)
        git('init','-q')
        git('fetch','-q','--depth=1','https://github.com/'+REPO,PIN)
        assert git('rev-parse','FETCH_HEAD^{tree}').decode().strip()==TREE
        files = git('ls-tree','-r','--name-only','FETCH_HEAD').decode().splitlines()
        paths = [p for p in files if p.endswith('.wav')]
        expected = [f'string-{i}/{j}/{k:02d}.wav' for i in range(1,7) for j in range(1,9) for k in range(1,6)]
        assert sorted(paths)==sorted(expected)
        pointers={}
        for path in paths:
            b=git('show','FETCH_HEAD:'+path)
            m=re.fullmatch(rb'version https://git-lfs.github.com/spec/v1\noid sha256:([0-9a-f]{64})\nsize ([0-9]+)\n',b)
            assert m and int(m[2])>1000,(path,len(b))
            pointers[path]=[m[1].decode(),int(m[2])]
        assert len(set(p[0] for p in pointers.values()))==240
        print(json.dumps({'commit':PIN,'tree':TREE,'roster':pointers,'misc':sorted(set(files)-set(paths))},sort_keys=True),flush=True)
        ref='string-1/1/01.wav'
        url=f'https://media.githubusercontent.com/media/{REPO}/{PIN}/{ref}'
        request=urllib.request.Request(url,headers={'Range':'bytes=0-511','User-Agent':'physical-source-format-qualification'})
        with urllib.request.urlopen(request,timeout=35) as response:
            # Read only RIFF and the fmt chunk; stop directly at data payload.
            raw=response.read(12);assert len(raw)==12 and raw[:4]==b'RIFF' and raw[8:]==b'WAVE'
            chunks=[];fmt=None;pos=12
            while pos<512:
                h=response.read(8);assert len(h)==8
                tag,size=struct.unpack('<4sI',h);pos+=8
                if tag==b'data':
                    assert fmt and size>0
                    print(json.dumps({'source_only_path':ref,'http':response.status,'length_OID':pointers[ref][1],'RIFF_size':struct.unpack('<I',raw[4:8])[0]+8,'fmt':fmt,'header_chunks':chunks,'sample_payload_start':pos,'sample_payload_bytes_read':0,'data_bytes':size,'all_other_WAVs_opened':0}),flush=True)
                    return
                assert pos+size+(size%2)<=512
                ch=response.read(size+(size%2));assert len(ch)==size+(size%2)
                if tag==b'fmt ':
                    assert size>=16;fmt=list(struct.unpack_from('<HHIIHH',ch))
                chunks.append([tag.decode('ascii'),size]);pos+=len(ch)
            raise ValueError('bounded header lacks data chunk')

if __name__=='__main__':
    run()
