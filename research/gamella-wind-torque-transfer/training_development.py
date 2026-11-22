import hashlib,json
from pathlib import Path
import numpy as np
from wind_transfer import fit,panel,forecasts
m=fit();u,y=panel('0.5');p=forecasts(m,u[4000:],y[4000:,:5]);ys=y[4000:,5:]
print(json.dumps({'n':len(ys),'middle_RMSE':{k:np.sqrt(((v-ys)**2).mean((0,1))).tolist() for k,v in p.items()},'walk_seed16_RMSE':m['walk_dev']}))
