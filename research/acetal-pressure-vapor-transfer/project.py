"""Project pressure calibrations and liquid-variable identities from the archived XML."""
import json
import xml.etree.ElementTree as ET

def tag(n): return n.tag.rsplit('}',1)[-1]
def kids(n,k): return [v for v in n if tag(v)==k]
def get(n,k): return next(v.text for v in n.iter() if tag(v)==k)

def project(path):
    root=ET.parse(path).getroot()
    d={}
    for ds in kids(root,'PureOrMixtureData'):
        idx=int(get(ds,'nPureOrMixtureDataNumber'))
        if idx in (6,7): continue
        out=[]
        for row in kids(ds,'NumValues'):
            var={int(get(v,'nVarNumber')):get(v,'nVarValue') for v in kids(row,'VariableValue')}
            r={'var':var}
            if idx in (1,2,4,8):
                value=kids(row,'PropertyValue')[0]
                r['u']=[(tag(n),n.text) for n in value.iter() if 'Uncert' in tag(n) and n.text and n.text.strip() and not list(n)]
                r['p']=get(value,'nPropValue')
            out.append(r)
        d[idx]=out
    return d
if __name__=='__main__':
    d=project('acetal.xml')
    print('INPUT_PROJECTION',json.dumps(d,separators=(',',':')))
    for a,b in [(2,3),(4,5),(8,9)]:
        A=[r['var'] for r in d[a]];B=[r['var'] for r in d[b]]
        print('ROW_ALIAS',a,b,len(A),len(B),A==B)
