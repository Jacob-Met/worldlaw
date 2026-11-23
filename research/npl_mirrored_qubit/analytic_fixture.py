import sys, json, numpy as np
from scipy.linalg import expm
import forecast as model
n=vars(model)
import generator_oracle as joint
g=vars(joint)
def dyn(p, t): return n['probabilities']('dynamic',p,t)
err=0;checked=0; inter=[]
for r,d,w,nu,lam in [(0,0,-.2,.35,0),(.12,.02,.07,.3,.3),(.31,.09,-.33,.1,.5),(.08,.04,.23,.7,.05)]:
 e=np.eye(16,dtype=complex)
 H=np.kron(np.diag([1,-1])*w/2,np.eye(2))+np.kron(np.diag([1,-1]),np.array(g['x']))*nu/2
 jd=np.array(g['lower']); js=[(r,np.kron(jd,np.eye(2))),(d,np.kron(np.diag([1,-1]),np.eye(2))),(4*lam,np.kron(np.eye(2),jd))]
 def rhs(b):
  v=-1j*(H@b-b@H)
  for rate,l in js:
   ll=l.conj().T@l
   v+=rate*(l@b@l.conj().T-.5*(ll@b+b@ll))
  return v
 mat=np.column_stack([rhs(x.reshape(4,4)).flatten() for x in e])
 start=np.kron(np.array([[.5,.5],[.5,.5]]),np.diag([1,0])).flatten()
 for k in range(16):
  joint=(expm(k*mat)@start).reshape(2,2,2,2)
  qr=np.trace(joint,axis1=1,axis2=3)
  probs=np.array([(1+np.trace(np.array(g[key])@qr).real)/2 for key in ('x','y','z')])
  rule=dyn([r,d,w,nu,lam],[k])[0]
  err=max(err,float(np.max(abs(rule-np.clip(probs,1e-9,1-1e-9)))));checked+=3
assert err<3e-13
# The prefix lexer must never convert the poison suffix, and both legal binary count encodings must agree.
text='['+','.join(["{'0x0': 653, '0x1': 371}"]*10+["{NOT AN ACTUAL DICTIONARY}"]*6)+']'
test={b:[{'counts':text}]*2 for b in 'XYZ'}
assert np.all(n['prefix'](test)==653)
assert n['count0']("{'0': 653, '1': 371}")==653
c=np.array([[[700,701],[450,452],[620,630]]]*10)
q=n['simple']('constant',c); assert np.all(q>0) and np.all(q<1)
print(json.dumps({'independent_joint_exponential_probabilities':checked,'max_absolute_error':err,'poison_suffix_protected':True,'measurement_counts_read':False,'numpy':np.__version__}))