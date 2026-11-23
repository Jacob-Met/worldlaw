"""Independent stdlib row-and-rotor census. Read first five kinematic fields only."""
import hashlib,json,pathlib,statistics,zipfile
def H():return hashlib.sha256()
def scan(path):
 h=H();m=hashlib.md5()
 with path.open('rb') as f:
    for block in iter(lambda:f.read(2**20),b''):h.update(block);m.update(block)
 return h.hexdigest(),m.hexdigest()
def main():
 import sys
 p=pathlib.Path(sys.argv[1]);assert p.stat().st_size==1351560391
 dig,md=scan(p);assert dig=='be4bca8565b16ecb8c0d992f5c9c3a9028e88a44ffbc64319c8a4181eb9e1367' and md=='741bce55204fdb910d38db0132baef9f'
 out={};hist={};kin={}
 with zipfile.ZipFile(p) as z:
    for spin,rpm in ((0,0),(1,137),(3,411)):
        names=[k for k in z.namelist() if k.startswith('Open Access Data/Alfa_'+str(spin)+'_Re_20k/') and k.endswith('_Data.dat')]
        assert len(names)==1
        width={};side=H();raw=H();rows=[];stage=[];minrow=None;maxrow=None
        with z.open(names[0]) as f:
            for i,line in enumerate(f):
                raw.update(line); fields=line.split()
                width[len(fields)]=width.get(len(fields),0)+1
                # Bind raw target columns through the member digest without converting Cd or Cl.
                side.update(b' '.join(fields[:3])+b'\n')
                t,u,x=tuple(map(float,fields[:3]));rows.append((t,u,x))
                if len(fields)==7:
                    accel=float(fields[3]);speed=float(fields[4]);entry=[i,t,u,x,accel,speed]
                    if maxrow is None or speed>maxrow[-1]:maxrow=entry
                    if minrow is None or speed<minrow[-1]:minrow=entry
                    if t<=5 and .4<=u<=.46:stage.append(speed)
        r={'name':names[0],'member_sha256':raw.hexdigest(),'first_three_lexical_sha256':side.hexdigest(),'rows':len(rows),'width_histogram':width,'first_three_kinematic_ranges':[[min(q[c] for q in rows),max(q[c] for q in rows)] for c in range(3)]}
        if stage:
            med=statistics.median(stage)
            r.update(dict(first5s_steady_translation_rpm_count=len(stage),steady_median_rpm=med,nominal_rpm=rpm,implied_surface_speed_ratio=med*2*3.141592653589793*.03/(60*.43),raw_min_kinematic_row=minrow,raw_max_kinematic_row=maxrow,relative_mismatch_to_411=abs(med-411)/411,relative_mismatch_to_137=abs(med-137)/137))
        out[str(spin)]=r;kin[spin]=rows
 dif=[sum(a[i]==b[i] for a,b in zip(kin[1],kin[3])) for i in (0,1,2)]
 print(json.dumps(dict(source_sha256=dig,cases=out,matched_ordinal_kinematic_cells_equal_1_vs_3=dif,compared_ordinal_rows=min(len(kin[1]),len(kin[3])),load_cells_decoded=0,piv_velocity_values_decoded=0),sort_keys=True))
if __name__=='__main__':main()
