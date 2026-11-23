import json,sys,hashlib,pathlib,lzma,io,numpy as np
from scipy.signal import butter,sosfilt,welch,find_peaks
def read_raw(base, ids):
    from pathlib import Path
    import zlib,re,itertools
    base=Path(base);directory=json.loads((base/'catalog.json').read_bytes());roster={r['index']:r for r in json.loads((base/'design-roster.json').read_bytes())}
    dec=lzma.LZMADecompressor(format=lzma.FORMAT_RAW,filters=[{'id':lzma.FILTER_LZMA2,'dict_size':directory['dict_size']}])
    def chunks():
        for n in ['original-packed-prefix.bin','original-packed-suffix-to-index56.bin']:
            with (base/n).open('rb') as f:
                while True:
                    b=f.read(2**20)
                    if not b:break
                    yield b
    stream=iter(chunks());remaining=set(ids)
    for member in directory['entries']:
        n=member['bytes'];buf=bytearray()
        while len(buf)<n:
            b=next(stream) if dec.needs_input else b''
            buf.extend(dec.decompress(b,max_length=min(n-len(buf),2**20)))
        assert zlib.crc32(buf)==member['crc32']
        typ,ix=re.fullmatch(r'(whole|beta|timestamp)_(\d+)\.csv',member['name'].split('/')[-1]).groups();ix=int(ix)
        if typ=='whole' and ix in remaining:
            assert hashlib.sha256(buf).hexdigest()==roster[ix]['sha256']
            yield roster[ix],bytes(buf)
            remaining.remove(ix)
            if not remaining:break
    if remaining:raise ValueError('missing source member')
def parse(raw,usecols=None):
    h=raw.split(b'\n',1)[0];sep=',' if b',' in h else ';' if b';' in h else None
    return np.loadtxt(io.BytesIO(raw),delimiter=sep,usecols=usecols)
def preprocess(x):
    # Match the AC bandwidth. Common causal filtering, low-pass before 10:1 downsampling, zero-state on centered channel.
    sos=butter(4,[25,800],btype='bandpass',fs=50000,output='sos')
    return sosfilt(sos,x-x[0],axis=0)[::10]
def pilot(row,raw):
    q=parse(raw);assert q.shape==(row['samples'],4) and np.isfinite(q).all()
    x=preprocess(q[:,2]);y=preprocess(q[:,3]);speed=q[::10,1]
    above=np.abs(speed)>=.02; run=np.convolve(above.astype(int),np.ones(50,dtype=int),'valid')
    start=int(np.flatnonzero(run==50)[0]) if np.any(run==50) else None
    sig=np.sqrt(np.mean(x*x));noise=np.sqrt(np.mean(x[:250]**2)); peak=int(np.argmax(abs(y)))
    analysis=(slice(start,min(start+500,len(x)))) if start is not None else slice(0,500)
    ar=x[analysis]; delayed=-np.interp(np.arange(len(x))-5000/(2*98),np.arange(len(x)),x,left=0)
    lead=float(np.dot(delayed,y)/max(1e-24,np.dot(delayed,delayed)))
    fre,p=welch(x,5000,nperseg=4096);off=(fre>25)&(fre<800)&(np.abs(fre-98*np.rint(fre/98))>=8)
    return dict(id=row['index'],beta=row['beta'],n_50k=len(q),onset_at_5k=start,motion_range=[float(np.min(speed)),float(np.max(speed))],reaction_range_N=[float(q[:,2].min()),float(q[:,2].max()),float(q[:,3].min()),float(q[:,3].max())],ac_bridge_rms=float(sig),initial_50ms_bridge_rms=float(noise),onset_100ms_bridge_rms=float(np.sqrt(np.mean(ar**2))),outside_nominal_8Hz_harmonic_bands_fraction=float(np.sum(p[off])/np.sum(p[(fre>25)&(fre<800)])),half_period_raw_correlation=float(np.corrcoef(delayed,y)[0,1]),half_period_signed_scale=lead,largest_raw_nut_ac=dict(index=peak,bridge=float(x[peak]),true=float(y[peak]),scaled_delay=float(lead*delayed[peak])))
