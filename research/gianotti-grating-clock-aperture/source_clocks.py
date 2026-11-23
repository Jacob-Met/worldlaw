"""Reconstruct the released excitation clocks and optical file layout without decoding strain or spectral ordinates."""
import argparse
import bisect
import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import zipfile

ARCHIVE_SHA = "3f213a17acac029248ee5acbebde5e0d13522d386577e8a393bb1b48a75b45f3"
MACHINE_SHA = "12da9518739fd9127f6b8beb92789cbdc0be8e3fa37219f9aa08aadf9eb07524"
DATE = datetime.date(2026, 2, 19)
FBG = re.compile(r"campaign_a/datasources/FBG/(up|down)/(\d+)/Responses\.(\d{14})\.txt")
OFDR = re.compile(r"campaign_a/datasources/OFDR/fixed-ref/(up|down)/5mm/(\d+)_Lower\.txt")
TIMESTAMP = re.compile(rb"^(\d{2}/\d{2}/\d{4}) (\d{2}):(\d{2}):(\d{2})(\.\d+)?$")
TOLERANCES = (2,5,10,20)

def require(ok, explanation):
    if not ok: raise ValueError(explanation)

def file_hash(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

def seconds(dt):
    require(dt.date()==DATE, "Unexpected optical acquisition date")
    return dt.hour*3600+dt.minute*60+dt.second+dt.microsecond/1e6

def measurement_inputs(archive):
    raw=archive.read("campaign_a/Lloyd_machine.txt")
    require(hashlib.sha256(raw).hexdigest()==MACHINE_SHA,"Load-cell file identity differs")
    lines=raw.decode("latin1").splitlines()
    require(lines[0].split("\t")==["Temps (s)","Force (N)","Allongement (mm)"],"Machine schema differs")
    # The released longitudinal displacement column remains unused.
    machine=[tuple(float(v) for v in line.split()[:2]) for line in lines[1:] if line.strip()]
    require(len(machine)==1000 and all(a[0]<b[0] for a,b in zip(machine,machine[1:])),"Machine time support differs")
    files=[]
    for member in archive.infolist():
        name=member.filename
        match=FBG.fullmatch(name)
        if match:
            branch,nominal,stamp=match.groups()
            file_clock=seconds(datetime.datetime.strptime(stamp,"%Y%m%d%H%M%S"))
            frame_clocks=[]
            row_widths=[]
            axis={}
            with archive.open(member) as stream:
                for line in stream:
                    if len(line)>50000:
                        # Only delimiter counts are observed for ordinates.
                        row_widths.append(line.count(b"\t")+1)
                        continue
                    row=line.strip()
                    time_match=TIMESTAMP.fullmatch(row)
                    if time_match:
                        day,h,m,s,frac=time_match.groups()
                        require(day==b"19/02/2026","Unexpected frame date")
                        frame_clocks.append(int(h)*3600+int(m)*60+int(s)+float(frac or b"0"))
                    for key in ("Wavelength Start (nm)","Wavelength Delta (nm)","Number of Points"):
                        if row.startswith(key.encode()+b":"):
                            axis[key]=float(row.split(b":",1)[1].strip().replace(b",",b"."))
            require(axis=={"Wavelength Start (nm)":1460.,"Wavelength Delta (nm)":0.008,"Number of Points":20000.},"Wavelength axis differs")
            require(frame_clocks and len(row_widths)==4*len(frame_clocks) and set(row_widths)=={20000},"Four-channel frame schema differs")
            require(all(a<b for a,b in zip(frame_clocks,frame_clocks[1:])),"Frame times are unordered")
            files.append(dict(device="FBG",branch=branch,load_N=int(nominal),name=name,stamp_s=file_clock,frame_s=frame_clocks))
        match=OFDR.fullmatch(name)
        if match:
            branch,nominal=match.groups()
            with archive.open(member) as stream: header=stream.readline(300).decode("ascii").strip()
            stamp=datetime.datetime.strptime(header,"Acquired on %m/%d/%Y at %H:%M:%S")
            files.append(dict(device="OFDR",branch=branch,load_N=int(nominal),name=name,stamp_s=seconds(stamp)))
    require(sum(row["device"]=="FBG" for row in files)==22 and sum(row["device"]=="OFDR" for row in files)==19,"Optical file census differs")
    return machine, sorted(files,key=lambda x:(x["stamp_s"],x["device"]))

def interval_union(items):
    result=[]
    for a,b in sorted(items):
        if result and a<=result[-1][1]:
            result[-1]=(result[-1][0],max(result[-1][1],b))
        else: result.append((a,b))
    return result

def intersection(left,right):
    return interval_union((max(a,c),min(b,d)) for a,b in left for c,d in right if max(a,c)<=min(b,d))

def allowed_clock_shifts(machine,stamp,load,tol):
    parts=[]
    for (a,fa),(b,fb) in zip(machine,machine[1:]):
        if fa==fb:
            if abs(fa-load)<=tol:parts.append((a-stamp,b-stamp))
            continue
        lo,hi=sorted(a+(b-a)*(target-fa)/(fb-fa) for target in (load-tol,load+tol))
        lo,hi=max(a,lo),min(b,hi)
        if lo<=hi:parts.append((lo-stamp,hi-stamp))
    return interval_union(parts)

def clock_course(machine,rows,tol):
    allowed=[allowed_clock_shifts(machine,r["stamp_s"],r["load_N"],tol) for r in rows]
    endpoints=sorted({p for ranges in allowed for ab in ranges for p in ab})
    require(endpoints,"No observed clock support")
    # On each open interval the subset of satisfied constraints is constant. Test boundaries too.
    probes=sorted(endpoints+[(a+b)/2 for a,b in zip(endpoints,endpoints[1:])])
    best=-1
    for candidate in probes:
        fits=[any(a<=candidate<=b for a,b in ranges) for ranges in allowed]
        if sum(fits)>best:
            best=sum(fits)
            first=round(candidate,9)
            misses=[rows[i]["name"] for i,ok in enumerate(fits) if not ok]
    feasible=allowed[0]
    for support in allowed[1:]:feasible=intersection(feasible,support)
    return dict(count=len(rows),maximum_compatible=best,first_maximizing_offset_s=first,
                misses_at_first_maximum=misses,complete_offset_windows_s=feasible)

def force_envelope(machine,start,end,offset):
    a,b=start+offset[0],end+offset[1]
    times=[t for t,_ in machine]
    if a<times[0] or b>times[-1]:return None
    def interpolate(t):
        i=max(0,min(len(times)-2,bisect.bisect_right(times,t)-1))
        (x,y),(z,w)=machine[i:i+2]
        return y+(w-y)*(t-x)/(z-x)
    vals=[interpolate(a),interpolate(b)]+[f for t,f in machine if a<=t<=b]
    return [min(vals),max(vals)]

def aperture_controls():
    import cmath
    def reflection(slopes,detuning):
        value=0j
        phase=0.
        for slope in slopes:
            k=detuning+slope
            integral=(cmath.exp(1j*k)-1)/(1j*k) if k else 1.
            value+=cmath.exp(1j*phase)*integral
            phase+=k
        return value
    first=[0.,0.,math.pi]
    second=[0.,math.pi,0.]
    powers=[abs(reflection(s,0))**2 for s in (first,second)]
    require(abs(powers[0]-powers[1]-4)<1e-12,"Equal-histogram fixture differs")
    maximum=max(abs(abs(reflection(first,d))**2-abs(reflection(first[::-1],d))**2) for d in (-7,-2,0,1,9))
    require(maximum<1e-12,"Conditional reversal fixture differs")
    return dict(equal_histogram_zero_detuning_powers=powers,reversal_maximum_fixture_difference=maximum,
                ideal_rectangular_3mm_response_to_5mm_period=math.sin(3*math.pi/5)/(3*math.pi/5))

def evaluate(path):
    require(file_hash(path)==ARCHIVE_SHA,"Gianotti/Magne v2.1 archive differs")
    with zipfile.ZipFile(path) as archive: machine,files=measurement_inputs(archive)
    by_role={role:{(r["branch"],r["load_N"]):r for r in files if r["device"]==role} for role in ("FBG","OFDR")}
    keys=sorted(by_role["FBG"].keys() & by_role["OFDR"].keys())
    paired=[r for r in files if (r["branch"],r["load_N"]) in keys]
    require(len(keys)==10 and len(paired)==20,"Same nominal load/branch overlap differs")
    census={}
    for name,subset in (("all41",files),("matched20",paired),("FBG22",list(by_role["FBG"].values())),("OFDR19",list(by_role["OFDR"].values()))):
        census[name]={str(tol):clock_course(machine,subset,tol) for tol in TOLERANCES}
    windows=census["matched20"]["10"]["complete_offset_windows_s"]
    require(len(windows)==1,"Paired actuator-clock registration differs")
    offset=windows[0]
    pairs=[]
    for branch,load in keys:
        f=by_role["FBG"][branch,load]
        o=by_role["OFDR"][branch,load]
        clocks=f["frame_s"]
        pairs.append(dict(branch=branch,load_N=load,fb_start_s=f["stamp_s"],ofdr_start_s=o["stamp_s"],
                          start_difference_s=o["stamp_s"]-f["stamp_s"],fb_frames=len(clocks),
                          fb_first_last_s=[clocks[0],clocks[-1]],fb_entire_interval_force_N=force_envelope(machine,clocks[0],clocks[-1],offset),
                          fb_first_force_N=force_envelope(machine,clocks[0],clocks[0],offset),
                          ofdr_start_force_N=force_envelope(machine,o["stamp_s"],o["stamp_s"],offset)))
    return dict(archive_sha256=ARCHIVE_SHA,machine_sha256=MACHINE_SHA,machine_rows=len(machine),optical_file_timing=files,
                constraint_sensitivity=census,ten_matched_pairs=pairs,conditional_mathematical_controls=aperture_controls(),
                optical_response_values_decoded=0,independently_synchronized_clocks=False)
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive",type=Path)
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    value=evaluate(args.archive)
    txt=json.dumps(value,sort_keys=True,indent=2,allow_nan=False)+"\n"
    if args.output:args.output.write_text(txt)
    else:print(txt,end="")
if __name__=="__main__":
    main()
