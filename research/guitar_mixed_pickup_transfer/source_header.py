"""Read source-only WAV structural fields by byte range, skipping metadata bodies."""
import json
import re
import struct
import urllib.request

PIN='d9d55a600210e40e6531d4b74891771c0a9a3718'
PATH='string-1/1/01.wav'
TOTAL=1381657
URL=f'https://media.githubusercontent.com/media/ZulfadhliM/electric-guitar-samples/{PIN}/{PATH}'


def get(offset,count):
    assert offset>=0 and count in (8,12,16) and offset+count<=TOTAL
    # Unique cache key prevents a cached first range masquerading as a later range.
    req=urllib.request.Request(URL+f'?header={offset}',headers={'Range':f'bytes={offset}-{offset+count-1}','User-Agent':'source-header'})
    with urllib.request.urlopen(req,timeout=30) as response:
        actual=response.headers.get('Content-Range','')
        assert response.status==206 and re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',actual)
        assert actual==f'bytes {offset}-{offset+count-1}/{TOTAL}',actual
        b=response.read(count);assert len(b)==count;return b


def run():
    header=get(0,12);assert header[:4]==b'RIFF' and header[8:]==b'WAVE'
    declared=struct.unpack('<I',header[4:8])[0]+8
    assert 12<=declared<=TOTAL
    at=12;fmt=None;seen=[]
    for _ in range(40):
        h=get(at,8);kind,n=struct.unpack('<4sI',h);tag=kind.decode('ascii')
        seen.append([at,tag,n]);print(json.dumps({'metadata_header':seen[-1]}),flush=True)
        assert at+8+n<=declared
        if tag=='data':
            assert fmt and fmt[1]==1 and fmt[2]==44100 and n>0 and n%fmt[4]==0
            print(json.dumps({'path':PATH,'git_lfs_total':TOTAL,'RIFF_length':declared,'trailing_bytes':TOTAL-declared,'fmt_tag_channels_rate_byterate_align_bits':fmt,'headers':seen,'n_frames':n//fmt[4],'data_payload_offset':at+8,'science_samples_read':0,'mixed_files_opened':0}));return
        if tag=='fmt ':
            assert n>=16;fmt=list(struct.unpack('<HHIIHH',get(at+8,16)))
        at+=8+n+n%2
    raise ValueError('40 structural RIFF chunks without declared samples')

if __name__=='__main__':
    run()
