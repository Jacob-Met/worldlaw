"""Role-limited projection of the independently measured APG-III author tables."""
import hashlib,json,re,subprocess,sys
from pathlib import Path

SRC='b3434079b37233fef3c8ea656a0e011d46f5ce7559d7893631a9c0c5cabce9b3'
TEMPERATURES=[333,303,273]
NAMES=['CH4','N2','CO2']
def page(path,n):
    return subprocess.check_output(['pdftotext','-layout','-f',str(n),'-l',str(n),str(path),'-']).decode()
def column(path,x,width):
    return subprocess.check_output(['pdftotext','-layout','-r','72','-f','67','-l','67',
       '-x',str(x),'-W',str(width),'-y','230','-H','435',str(path),'-']).decode().split()
def eligible_rows(text):
    for line in text.splitlines():
        if not line.strip():continue
        # Temperature group labels are centered in the printed table's first column.
        if line[:4].strip() in ('273','303','333'):line='    '+line[4:]
        if not re.match(r'^\s*\d{2,3}\s+0?\.[0-9]',line):
            if not re.match(r'^\s*\d{2,3}\s+1\.00\s',line):continue
        yield line
def training(path):
    pure=[]
    for line in eligible_rows(page(path,50)):
        values=list(map(float,line.split()))
        if len(values)==12:which=[0,1,2]
        elif len(values)==8 and len(line)-len(line.lstrip())>30:which=[1,2]
        else:raise ValueError('pure-source table layout incompatible')
        for k,i in enumerate(which):
            P,y,q,u=values[k*4:k*4+4]
            pure.append(dict(i=i,P=P,y=y,q=q,u=u))
    for i,nn in enumerate([27,29,29]):
        arm=[row for row in pure if row['i']==i];assert len(arm)==nn,(i,len(arm))
        group=0;last=0
        for row in arm:
            if last>800 and row['P']<150:group+=1
            row['T']=TEMPERATURES[group];last=row['P']
        assert group==2
    bins=[]
    sections=[(page(path,54).split('Table 4. CH4+CO2 binary mixture adsorption capacity data')[-1],0,2),
        (page(path,55).split('Table 6. CH4+N2 binary mixture adsorption capacity data')[0],1,2),
        (page(path,55).split('Table 6. CH4+N2 binary mixture adsorption capacity data')[-1],0,1)]
    for text,i,j in sections:
        rows=list(eligible_rows(text));assert len(rows)==18,(i,j,len(rows))
        for n,line in enumerate(rows):
            v=line.split();assert len(v)==8,(n,v)
            P,yi,qi,ui,yj,qj,uj=map(float,v[:7]);T=TEMPERATURES[n//6]
            assert (P<200)==(n%6<3)
            y=[0.,0.,0.];y[i]=yi;y[j]=yj
            bins.append(dict(T=T,P=P,y=y,components=[i,j],q=[qi,qj],u=[ui,uj]))
    return pure,bins
def held_inputs(path):
    cols=[column(path,*a) for a in [(56,34),(91,39),(134,38),(271,38),(404,40)]]
    assert list(map(int,cols[0]))==TEMPERATURES
    P,*y=[list(map(float,r)) for r in cols[1:]]
    assert len(P)==27 and all(len(v)==27 for v in y)
    out=[]
    for i,pressure in enumerate(P):
        fractions=[v[i] for v in y]
        assert abs(sum(fractions)-1)<.025 and all(0<v<1 for v in fractions)
        center=[100,500,900][(i%9)//3];assert abs(pressure-center)<30
        out.append(dict(row=i,T=TEMPERATURES[i//9],P=pressure,y=fractions,pressure_group=center))
    return out
def main():
    path=Path(sys.argv[1])
    assert hashlib.sha256(path.read_bytes()).hexdigest()==SRC
    pure,binary=training(path); inputs=held_inputs(path)
    out={'chemical_order':NAMES,'source_sha256':SRC,'pure':pure,'binary':binary,'ternary_inputs':inputs,'target_capacity_columns_extracted':0,'unrounded_uncertainties_available':False}
    Path('projected-calibration-and-inputs.json').write_text(json.dumps(out,sort_keys=True,separators=(',',':')))
    print('QUALIFIED',len(pure),len(binary),len(inputs),len(binary)*2,'held_capacity_values_projected',0,flush=True)
if __name__=='__main__':main()
