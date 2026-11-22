"""Check the released mounted equations using exact rational trigonometric states."""
import ast
import cmath
from fractions import Fraction as F
import hashlib
import json
from pathlib import Path
import re
import sys


def degree(node):
    if isinstance(node, ast.Constant):
        return 0
    if isinstance(node, ast.Name):
        return int(node.id in {"m1", "m2", "I1", "I2", "k1", "k2"})
    if isinstance(node, ast.UnaryOp):
        return degree(node.operand)
    if isinstance(node, ast.Call):
        assert node.func.id in {"sin", "cos"} and degree(node.args[0]) == 0
        return 0
    assert isinstance(node, ast.BinOp)
    a, b = degree(node.left), degree(node.right)
    if isinstance(node.op, (ast.Add, ast.Sub)):
        assert a == b
        return a
    if isinstance(node.op, ast.Mult):
        return a + b
    if isinstance(node.op, ast.Div):
        return a - b
    assert isinstance(node.op, ast.Pow) and isinstance(node.right, ast.Constant)
    return a * node.right.value


class Phase:
    def __init__(self, c=1, s=0):
        self.c, self.s = F(c), F(s)
        assert self.c**2 + self.s**2 == 1

    def __add__(self, other):
        return Phase(self.c * other.c - self.s * other.s,
                     self.c * other.s + self.s * other.c)

    def __sub__(self, other):
        return self + Phase(other.c, -other.s)

    def __rmul__(self, n):
        assert isinstance(n,int) and n >= 0
        value = Phase()
        for i in range(n):
            value = value + self
        return value

    @classmethod
    def half_tangent(cls, t):
        t = F(t)
        return cls((1-t*t)/(1+t*t), 2*t/(1+t*t))


def evaluate(code, params, state):
    variables = dict(zip("m1 m2 a1 a2 L1 I1 I2 k1 k2 g".split(),params))
    variables.update(dict(zip(["q1","q2","w1","w2"],state)))
    variables.update(sin=lambda p:p.s,cos=lambda p:p.c)
    return tuple(eval(c,{"__builtins__":{}},variables) for c in code)


def compact(params, state, gravity):
    m,n,a,b,L,I,J,k,h,g = params
    p,q,u,v = state
    A,B,C=I+m*a*a+n*L*L,J+n*b*b,n*L*b
    D=C*(p-q).c
    G,H=g*(m*a+n*L),g*n*b
    s=(p-q).s
    f=gravity*G*p.s-C*s*v*v-k*u+h*(v-u)
    z=gravity*H*q.s+C*s*u*u-h*(v-u)
    return ((B*f-D*z)/(A*B-D*D),(A*z-D*f)/(A*B-D*D))


def main(path):
    d=json.loads(Path(path).read_text())["author_scripts"]
    base="ParameterEstimation/DoublePendulum/"
    src=d[base+"DoublePendulumODE_Mounted.m"]["source"]
    assert hashlib.sha256(src.encode()).hexdigest()=="f0c33b17a866ee4b95171534aa956a379a8ab9752f1269dd98e112486e0a25e9"
    symbolic=d[base+"DoublePendulumSymbolicCalculation.m"]["source"]
    assert hashlib.sha256(symbolic.encode()).hexdigest()=="d77387d051f3940e0132c8cc8684f5a10f48369ec5cb315f4a0b86e0f4213eeb"
    for text in ("y1=-a1*cos(the1);","y2=-L1*cos(the1)-a2*cos(the2);","PEng=m1*g*y1+m2*g*y2;"):
        assert text in symbolic
    code=[]
    for i in [3,4]:
        raw=re.search(rf"^dydt\({i},1\)=(.*);",src,re.M)[1]
        raw=raw.replace("^","**")
        for j,x in enumerate(["q1","q2","w1","w2"],1):
            raw=raw.replace(f"y({j})",x)
        ast_node=ast.parse(raw, mode="eval")
        assert degree(ast_node.body)==0
        code.append(compile(ast_node,"published-matlab-rhs","eval"))
    params=list(map(F, [1,1,1,1,1,1,1,1,1,1]))
    side=(Phase(0,1),Phase(0,1),F(0),F(0))
    positive=evaluate(code,params,side)
    assert positive==(F(3,5),F(1,5))==compact(params,side,+1)
    assert compact(params,side,-1)==tuple(-x for x in positive)
    tested=0
    for i in range(1,14):
        params=[F(2*i+3,i+1),F(3*i+7,2*i+1),F(i,i+4),F(2,i+3),F(i+1,i+2),F(i+2,i+5),F(i+7,i+4),F(i+7,101),F(i,137),F(98083,10000)]
        for j in range(-3,4):
            state=(Phase.half_tangent(F(i,7)),Phase.half_tangent(F(j,4)),F(j*i,3),F(j+1,2))
            observed=evaluate(code,params,state)
            assert compact(params,state,+1)==observed
            scaled=[x*F(13,7) if t in (0,1,5,6,7,8) else x for t,x in enumerate(params)]
            assert evaluate(code,scaled,state)==observed
            tested+=1
    print(json.dumps(dict(source_sha=d[base+"DoublePendulumODE_Mounted.m"]["sha"],symbolic_sha=d[base+"DoublePendulumSymbolicCalculation.m"]["sha"],exact_states=tested,gravity_witness=[str(x) for x in positive],homogeneous_acceleration_degrees=[0,0])))


if __name__=="__main__":
    main(sys.argv[1])
