"""Give a reciprocal terminal-law ambiguity for one omitted KTC drive/edge row."""
import numpy as np


def row_witness(currents, sensing, level, injection, edge):
    """Zero-based row indexes, one-based challenge level. Units use V/mA."""
    assert currents.shape==(32,76) and sensing.shape==(32,31)
    assert 1<=level<=7 and 0<=injection<76 and 0<=edge<31
    u=currents[:,injection];v=sensing[:,edge]
    removed=2*(level-1);k=32-removed
    projector=np.zeros((32,32))
    projector[removed:,removed:]=np.eye(k)-np.ones((k,k))/k
    observed_i=~np.any(currents[:removed,:]!=0,axis=0)
    observed_v=~np.any(sensing[:removed,:]!=0,axis=0)
    if observed_i[injection] and observed_v[edge]:
        return {"retained_identity":(edge,injection)}
    # A and Delta are real symmetric and gauge invariant. At a strictly
    # positive interior base, their scaled perturbation preserves passivity.
    a=np.outer(u,v)+np.outer(v,u)
    delta=a-projector@a@projector
    delta/=np.linalg.norm(delta,'fro')
    base=np.eye(32)-np.ones((32,32))/32
    plus=base+0.25*delta;minus=base-0.25*delta
    assert np.linalg.norm((sensing[:,observed_v].T@delta@currents[:,observed_i]),ord=np.inf)<1e-10
    separation=(v@plus@u)-(v@minus@u)
    assert separation>1e-12
    return {"base_plus":plus,"base_minus":minus,"delta":delta,
            "changed_query_V":float(separation),"gauge_null":True,
            "zero_sum_energy_floor_V_per_mA":0.75}
