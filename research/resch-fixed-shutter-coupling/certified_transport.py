"""Synthetic qualification of an outer bound for a third central moment with fixed marginal laws."""
from collections import Counter
from fractions import Fraction
from itertools import product, permutations
from math import factorial

import numpy as np
from scipy.optimize import linprog
from scipy.sparse import coo_matrix


def potential_bound(marginals, cost, potentials):
    """Certify a lower bound for E[cost(sum)] under every joint coupling."""
    least = {0: Fraction(0)}
    # Find the largest total marginal potential at each terminal sum.
    for marginal, prices in zip(marginals, potentials):
        largest = {}
        for s, old_price in least.items():
            for value in marginal:
                successor = s + value
                price = old_price + prices[value]
                if successor not in largest or price > largest[successor]:
                    largest[successor] = price
        least = largest
    repair = min(cost(s) - v for s, v in least.items())
    expected = sum(p * potentials[i][value]
                   for i, marginal in enumerate(marginals)
                   for value, p in marginal.items())
    return expected + repair


def lower_flow_dual(marginals, cost):
    """Use the float LP only to suggest prices; the final bound uses rational arithmetic."""
    flow_equations = {}
    marginal_equations = {}
    rhs = []
    for i, marginal in enumerate(marginals):
        for value, probability in sorted(marginal.items()):
            marginal_equations[i, value] = len(rhs)
            rhs.append(float(probability))
    supports = [{0}]
    for marginal in marginals:
        supports.append({old + value for old in supports[-1] for value in marginal})
    for i in range(1, len(marginals)):
        for s in sorted(supports[i]):
            flow_equations[i, s] = len(rhs)
            rhs.append(0.)
    rr, cc, vals, objective = [], [], [], []
    def coefficient(row, col, val):
        rr.append(row)
        cc.append(col)
        vals.append(val)
    for i, marginal in enumerate(marginals):
        for state in sorted(supports[i]):
            for value in sorted(marginal):
                col = len(objective)
                successor = state + value
                terminal = i + 1 == len(marginals)
                objective.append(float(cost(successor)) if terminal else 0.)
                coefficient(marginal_equations[i, value], col, 1.)
                if i:
                    coefficient(flow_equations[i, state], col, -1.)
                if not terminal:
                    coefficient(flow_equations[i+1, successor], col, 1.)
    matrix = coo_matrix((vals,(rr,cc)), shape=(len(rhs),len(objective))).tocsr()
    result = linprog(objective, A_eq=matrix, b_eq=rhs, bounds=(0., None), method="highs")
    assert result.success, result.message
    precision = 10**9
    prices = [
        {v:Fraction(round(float(result.eqlin.marginals[marginal_equations[i,v]])*precision),
                    precision)
         for v in marginal}
        for i, marginal in enumerate(marginals)
    ]
    bound = potential_bound(marginals, cost, prices)
    return bound, prices, result.fun


def bracket(columns, center, grid=32):
    columns = [[Fraction(x) for x in column] for column in columns]
    center = Fraction(center)
    bases = list(map(min, columns))
    spread = max(max(x)-min(x) for x in columns)
    origin = sum(bases) - center
    if not spread:
        return origin**3, origin**3
    step = spread / grid
    scale = max(Fraction(1), abs(origin), abs(origin + len(columns)*spread))
    def cost(s):
        return ((origin+s*step)/scale)**3
    result = []
    for sign in [1,-1]:
        marginals = []
        for col, base in zip(columns, bases):
            counts = Counter()
            for x in col:
                rational = (x-base)/step
                index = rational.numerator//rational.denominator if sign==1 else -((-rational.numerator)//rational.denominator)
                counts[index] += 1
            marginals.append({v:Fraction(n,len(col)) for v,n in counts.items()})
        bound, _, _ = lower_flow_dual(marginals, lambda s: sign*cost(s))
        result.append(sign*bound*scale**3)
    return tuple(result)


def tests():
    # Two marginals: exact minimum/maximum is attained by a permutation.
    tests = [
        ([-2,-1,0,1],[-3,0,1,4]),
        ([0,0,1,3],[0,1,2,4]),
        ([1,1,1,1],[-4,0,1,3]),
    ]
    for a,b in tests:
        center = Fraction(sum(a)+sum(b),len(a))
        ground = [sum((Fraction(x+y)-center)**3 for x,y in zip(a,perm))/len(a)
                  for perm in permutations(b)]
        for grid in [4,9,28]:
            lower,upper=bracket([a,b],center,grid)
            assert lower<=min(ground)<=max(ground)<=upper
            if grid==28 and max(max(a)-min(a),max(b)-min(b)) in [4,7]:
                assert max(min(ground)-lower,upper-max(ground))<Fraction(1,100000)
    # Three-marginal path-flow dual against every eight-atom joint density.
    marginals=[{0:Fraction(1,2),1:Fraction(1,2)}]*3
    c=lambda s:(Fraction(s)-Fraction(3,2))**3
    for sign in [1,-1]:
        low,prices,numerical=lower_flow_dual(marginals,lambda s:sign*c(s))
        assert abs(low+Fraction(3,4))<Fraction(1,100000), (low,numerical)
        # Deliberately corrupt the candidate dual. Rational slack repair remains sound.
        prices[0][0]+=100
        assert potential_bound(marginals,lambda s:sign*c(s),prices)<=-Fraction(3,4)
    assert bracket([[1]*4,[-2]*4],Fraction(0))==(-1,-1)
    print("Finite-source transport checks passed, including exact third moments ±3/4")


if __name__ == "__main__":
    tests()
