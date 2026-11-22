"""Acquire immutable archives and compute only the matched, role-authorized surfaces."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile
import time
import urllib.request
import zipfile
import libarchive
import numpy as np
from scipy.io import loadmat
from surface import surface, FREQ, ORDER

ALL_CONDITIONS=('N15_M07_F10','N09_M07_F10')
PUBLIC_ID='15845309'

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1<<20),b''):
            h.update(block)
    return h.hexdigest()


def acquisition(ident,folder,registry):
    row=registry[ident]
    path=folder/(ident+'.rar')
    if not path.exists():
        url=f'https://zenodo.org/records/{PUBLIC_ID}/files/{ident}.rar?download=1'
        with tempfile.NamedTemporaryFile(dir=folder,suffix='.part',delete=False) as tmp:
            partial=Path(tmp.name)
            try:
                with urllib.request.urlopen(url,timeout=150) as response:
                    for chunk in iter(lambda:response.read(1<<20),b''):
                        tmp.write(chunk)
                tmp.flush()
                if partial.stat().st_size!=row['size'] or digest(partial)!=row['sha256']:
                    raise ValueError(f'Archival identity mismatch for {ident}')
                partial.replace(path)
            finally:
                if partial.exists():partial.unlink()
    if path.stat().st_size!=row['size'] or digest(path)!=row['sha256']:
        raise ValueError(f'Pinned archive mismatch for {ident}')
    return path


def unit_text(value):
    a=np.asarray(value)
    return str(a.item()).strip() if a.size==1 else 'unreported' if a.size==0 else str(a)


def channel_clock(record,channel,nominal):
    axes=np.atleast_1d(record.X)
    ix=channel.XIndex
    if not np.isscalar(ix) or int(ix)!=ix or not 1<=ix<=len(axes):
        raise ValueError('Invalid MATLAB channel XIndex')
    axis=axes[int(ix)-1]
    t=np.asarray(axis.Data,dtype=float).reshape(-1)
    if len(t)!=np.size(channel.Data) or len(t)<2 or not np.isfinite(t).all():
        raise ValueError('Time axis cannot be paired to every sample')
    delta=np.diff(t)
    if np.any(delta<=0):raise ValueError('Nonincreasing channel time')
    median=float(np.median(delta))
    mean_rate=float((len(t)-1)/(t[-1]-t[0]))
    report={'x_index':int(ix),'time_unit':unit_text(getattr(axis,'Unit',[])),
            'raster':unit_text(getattr(axis,'Raster',[])),'samples':len(t),
            'first':float(t[0]),'last':float(t[-1]),'mean_rate':mean_rate,
            'median_rate':1/median,'minimum_dt':float(delta.min()),
            'maximum_dt':float(delta.max()),'time_sha256':hashlib.sha256(t.astype('<f8').tobytes()).hexdigest()}
    if any(abs(rate/nominal-1)>.01 for rate in [mean_rate,1/median]):
        raise ValueError(f'Clock differs from the nominal estimator grid: {report}')
    if report['time_unit'].lower() not in ('','s','sec','second','seconds','unreported'):
        raise ValueError(f'Unknown time-axis scaling: {report}')
    return report


def verify_forecast(lock,expected,protocol,protocol_sha):
    if not expected or digest(lock)!=expected:
        raise ValueError('Complete published forecast SHA256 required before held access')
    with zipfile.ZipFile(lock) as z:
        meta=json.loads(z.read('lock.json'))
        if meta['protocol_sha256']!=protocol_sha or meta['held_low_files_read']!=0:
            raise ValueError('Forecast protocol or scope mismatch')
        if set(meta['held'])!=set(protocol['held']) or set(meta['source_hashes'])!=set(protocol['held']):
            raise ValueError('Missing or excess held bearing')
        required={'lock.json'}
        for ident in protocol['held']:
            if set(meta['held'][ident])!=set(protocol['roles']):
                raise ValueError(f'Incorrect forecast role roster for {ident}')
            for role in protocol['roles']:
                name=f'{ident}/{role}.npy'
                required.add(name)
                with z.open(name) as member:
                    if hashlib.file_digest(member,'sha256').hexdigest()!=meta['held'][ident][role]:
                        raise ValueError(f'Forecast digest mismatch: {name}')
        names=z.namelist()
        if len(names)!=len(required) or set(names)!=required:
            raise ValueError('Unexpected, repeated or missing forecast member')


def read_surface(path,ident,allowed):
    trial_pattern=re.compile(rf'^(N\d\d_M\d\d_F\d\d)_{ident}_(\d+)\.mat$')
    result={};names=set();start=time.monotonic()
    with libarchive.file_reader(str(path)) as reader:
        for member in reader:
            filename=Path(member.pathname.replace(chr(92), '/')).name
            match=trial_pattern.fullmatch(filename)
            if not match:continue
            condition,rep=match.group(1),int(match.group(2))
            if (condition,rep) in names:raise ValueError(f'Duplicate member {filename}')
            names.add((condition,rep))
            if condition not in allowed:continue
            # Entry content for withheld conditions is never requested from libarchive.
            raw=b''.join(member.get_blocks())
            m=loadmat(io.BytesIO(raw),squeeze_me=True,struct_as_record=False)
            stem=Path(filename).stem
            if set(m)-{'__header__','__version__','__globals__'}!={stem}:
                raise ValueError(f'Unexpected MATLAB trial variable {filename}')
            record=m[stem]
            ys=np.atleast_1d(record.Y)
            channels={str(y.Name):y for y in ys}
            if len(channels)!=len(ys):raise ValueError(f'Duplicate channel name: {filename}')
            clocks={k:channel_clock(record,channels[k],rate) for k,rate in [('speed',4000.),('vibration_1',64000.)]}
            rpm_unit=unit_text(getattr(channels['speed'],'Unit',[]))
            if rpm_unit.lower() not in ('','rpm','1/min','min-1','min^-1','unreported','r/min'):
                raise ValueError(f'Unexpected native speed unit: {rpm_unit}')
            rpm=np.asarray(channels['speed'].Data).reshape(-1)
            acc=np.asarray(channels['vibration_1'].Data).reshape(-1)
            Q,P,n=surface(acc,rpm)
            nominal=25 if condition==ALL_CONDITIONS[0] else 15
            if not .80*nominal<=n<=1.20*nominal:raise ValueError(f'RPM scale/conditioning mismatch: {filename} {n}')
            if condition not in result:
                result[condition]=[np.zeros_like(Q),np.zeros_like(P),[]]
            Qsum,Psum,receipts=result[condition]
            Qsum+=Q;Psum+=P
            receipts.append({'rep':rep,'sha256_mat':hashlib.sha256(raw).hexdigest(),
                'vibration_sha256':hashlib.sha256(np.asarray(acc,dtype='<f8').tobytes()).hexdigest(),
                'rpm_hz':n,'rpm_samples':len(rpm),'vibration_samples':len(acc),
                'vibration_native_unit':unit_text(getattr(channels['vibration_1'],'Unit',[])),'clocks':clocks,
                'speed_native_unit':rpm_unit})
    expected={(c,i) for c in allowed for i in range(1,21)}
    if {(c,r['rep']) for c,(_,_,rs) in result.items() for r in rs}!=expected:
        raise ValueError('Incomplete matched acquisition')
    return result,len(names),time.monotonic()-start


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('stage',choices=['development','high_only','held_low'])
    parser.add_argument('ids',nargs='+')
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--forecast-sha256')
    args=parser.parse_args()
    home=Path(__file__).resolve().parent
    protocol=json.loads((home/'protocol.json').read_text())
    allowed_ids=protocol['development']+protocol['healthy'] if args.stage=='development' else protocol['held']
    if len(set(args.ids))!=len(args.ids) or any(i not in allowed_ids for i in args.ids):
        raise ValueError('Cohort/stage mismatch')
    if args.stage=='held_low':
        lock=args.root/'forecasts.zip'
        verify_forecast(lock,args.forecast_sha256,protocol,digest(home/'protocol.json'))
    conditions={'development':ALL_CONDITIONS,'high_only':[ALL_CONDITIONS[0]],'held_low':[ALL_CONDITIONS[1]]}[args.stage]
    reg={Path(r['name']).stem:r for r in json.loads((home/'independent-archive-lock.json').read_text())['files']}
    args.root.mkdir(parents=True,exist_ok=True)
    raw_folder=args.root/'archives';raw_folder.mkdir(exist_ok=True)
    out=args.root/args.stage;out.mkdir(exist_ok=True)
    for ident in args.ids:
        destination=out/(ident+'.npz')
        if destination.exists():raise FileExistsError(destination)
        archive=acquisition(ident,raw_folder,reg)
        data,count,elapsed=read_surface(archive,ident,conditions)
        arrays={};info={'id':ident,'stage':args.stage,'archive':reg[ident]['sha256'],
             'members_enumerated':count,'seconds':elapsed,'conditions':{}}
        for c,(Q,P,receipts) in data.items():
            rs=sorted(receipts,key=lambda v:v['rep'])
            info['conditions'][c]=rs
            arrays[c+'_surface']=Q/len(rs)
            arrays[c+'_psd']=P/len(rs)
        arrays['receipt']=json.dumps(info,sort_keys=True)
        with tempfile.NamedTemporaryFile(dir=out,suffix='.part',delete=False) as f:
            name=Path(f.name)
            try:
                np.savez_compressed(f,**arrays);f.flush();name.replace(destination)
            finally:
                if name.exists():name.unlink()
        print('COMPLETED',ident,args.stage,round(elapsed,3),digest(destination),flush=True)


if __name__=='__main__':
    main()
