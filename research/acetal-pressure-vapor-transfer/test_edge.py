"""Refuse infeasible edge increments even when the source interval is broad."""
import numpy as np
from stable import propagate
def run():
    inputs=[(0.,10.),(0.,10.),(0.,10.)]
    low=np.array([[3.,.5]]); high=np.array([[2.,1.]])
    next_low=np.array([[0.],[0.]]); next_hi=next_low.copy()
    history=propagate(inputs,[(low,high),(next_low,next_hi)])
    assert history[1][0]==[]
    assert history[1][1]==[[.5,10.]]
    assert history[2][0]==[[.5,10.]]
if __name__=='__main__':run()
