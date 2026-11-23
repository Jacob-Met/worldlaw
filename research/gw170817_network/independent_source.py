"""Independent windowed matched-filter check at the frozen source-bank winner."""
import hashlib
import json
import math
import tempfile
from pathlib import Path
from urllib.request import Request,urlopen

import h5py
import lal
import lalsimulation
import numpy as np


def get_stream(p, expected, directory):
    assert p["detector"] in ("L1","V1") and p["detector"]+"_" in p["url"]
    dest=directory/p["detector"]
    digest=hashlib.sha256()
    with urlopen(Request(p["url"],headers={"User-Agent":"Independent source-only archived strain receiver"}),timeout=60) as response,dest.open("xb") as out:
        while True:
            buf=response.read(1024*1024)
            if not buf:break
            digest.update(buf)
            out.write(buf)
    assert digest.hexdigest()==expected["sha256"] and dest.stat().st_size==expected["bytes"]
    with h5py.File(dest) as h:
        start=int(h["meta/GPSstart"][()])
        count=(int(1187008882.43)-start+9)*4096
        return start,h["strain/Strain"][:count]


def manual_spectrum(data, frequencies):
    length=32768
    window=.5-.5*np.cos(2*np.pi*np.arange(length)/length)
    per=[]
    for pos in range(0,600*4096-length+1,length//2):
        ft=np.fft.rfft(data[pos:pos+length]*window)
        per.append(abs(ft)**2)
    n=len(per)
    correction=1+sum(1/(2*i+1)-1/(2*i) for i in range(1,(n-1)//2+1))
    density=2*np.median(per,axis=0)/(4096*np.dot(window,window)*correction)
    return np.interp(frequencies,np.fft.rfftfreq(length,1/4096),density)


def relative_snr(folder):
    protocol=json.loads((folder/"protocol.json").read_text())
    result=json.loads((folder/"screen-receipt.json").read_text())
    rate=4096;length=64*rate;df=1/64
    freq=np.fft.rfftfreq(length,1/rate)
    bins=np.where((freq>=35)&(freq<=100)&((freq<59)|(freq>61)))[0]
    mass=result["fine"]["chirp_mass"]*2**.2*lal.MSUN_SI
    hp,_=lalsimulation.SimInspiralChooseFDWaveform(mass,mass,0,0,0,0,0,0,1.e6*lal.PC_SI,0,0,0,0,0,df,35.,100.,35.,lal.CreateDict(),lalsimulation.TaylorF2)
    templ=np.zeros(len(freq),complex);templ[:len(hp.data.data)]=hp.data.data
    t=np.arange(length)/rate
    window=np.ones(length)
    edge=4096* (length-1)/length
    for j in range(4097):
        if j<=edge:
            weight=.5*(1-np.cos(np.pi*j/edge))
            window[j]=window[-1-j]=weight
    recovered={}
    with tempfile.TemporaryDirectory() as tmp:
        for prod in protocol["catalog"]["selected"]:
            k=prod["detector"]
            if k not in ("L1","V1"):continue
            start,values=get_stream(prod,result["source_products"][k],Path(tmp))
            center=int(1187008882.43)-start
            period=manual_spectrum(values,freq[bins])
            wd=window.copy()
            times=[result["fine"]["local_time"]]
            if k=="L1":
                dist=abs(start+center-56-1187008881+t-.389)
                wd*=.5*(1-np.cos(np.pi*np.clip((dist-.1)/.5,0,1)))
            else:
                mid=times[0]+result["relative_arrival_V_minus_L_s"]
                times=[mid+j/rate for j in range(-4,5)]
            rows=[]
            for n in ([center] if k=="L1" else [center]+[680+64*j for j in range(18)]):
                sample=values[(n-56)*rate:(n+8)*rate]
                signal=np.fft.rfft(sample*wd)[bins]/rate
                sn=[]
                for tau in times:
                    spectrum=templ*np.exp(-2j*np.pi*freq*tau)
                    a,b=[np.fft.rfft(wd*np.fft.irfft(spectrum*p,n=length))[bins] for p in (1,1j)]
                    def ip(x,y):return 4*df*np.sum((x.conj()*y).real/period)
                    aa,ab,bb=ip(a,a),ip(a,b),ip(b,b)
                    ax,bx=ip(a,signal),ip(b,signal)
                    sn.append(math.sqrt((bb*ax*ax-2*ab*ax*bx+aa*bx*bx)/(aa*bb-ab*ab)))
                rows.append(max(sn))
            recovered[k]=rows
    expected=[result["fine"]["snr"],result["virgo"]["snr"]]+[z["snr"] for z in result["background"]]
    actual=recovered["L1"]+recovered["V1"]
    err=max(abs(a-b) for a,b in zip(actual,expected,strict=True))
    assert err<1e-7,err
    return {"source_files":2,"held_files":0,"statistics":len(actual),"max_SNR_difference":err,"SNR":recovered}


if __name__=="__main__":
    print(json.dumps(relative_snr(Path(__file__).parent),sort_keys=True))
