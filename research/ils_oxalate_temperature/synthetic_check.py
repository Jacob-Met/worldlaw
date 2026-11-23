"""Check the source schedule and analytical sign selection on artificial smooth steps."""
import json
import numpy as np
from forecast import features,one_group

t=np.linspace(40,850,1000);base=100-12/(1+np.exp(-(t-150)/7))-20/(1+np.exp(-(t-455)/9))-30/(1+np.exp(-(t-690)/14))
stop=int(np.searchsorted(t,280,side="right"))
xn=np.array([0.,0.,0.,0.]); fake=(xn,np.ones(4),np.zeros(1000),np.zeros((4,1000)))
records=[]
for reference_slope,sign in [(1.012,1),(.988,-1)]:
    zinc=419.527; intercept=zinc+2*sign-reference_slope*zinc
    target=np.interp((t-intercept)/reference_slope,t,base)+.25
    early=np.broadcast_to(target[:stop],(5,stop)).copy()
    p,geo=one_group(t,base,early,fake)
    label="zinc_"+("plus" if sign>0 else "minus")
    assert geo["chosen"]["zinc"]==label
    err=float(np.max(abs(p["zinc"][t>=320]-target[t>=320])))
    assert err<.1
    records.append(dict(sign=sign,reference_slope=reference_slope,chosen=label,maximum_late_mass_error=err))
print(json.dumps({"records":records,"observed_instrument_curves_read":False},sort_keys=True))
