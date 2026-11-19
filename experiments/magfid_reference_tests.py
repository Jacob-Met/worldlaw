#!/usr/bin/env python3
"""Independent, held-out source-only numerical falsifiers for MAGF-ID Conf2.

No original numeric source input and no tuneable experiment flags are used.
The analytic matrix model, held-out instances and checks are locked to seed
20261119; running this file is not physical transfer or sensor calibration.
"""
from __future__ import annotations
import json
import numpy as np
import magfid_reference as r

SEED=20261119


def synthetic():
    rng=np.random.default_rng(SEED)
    lags,t=r.lag_indices()
    common=.28*np.exp(-t/.54)
    private=np.array([.07,.095,.11,.145])
    exact=np.zeros((28,4,4))
    for k in range(28):
        exact[k]=np.ones((4,4))*common[k]
        exact[k].flat[::5]+=private if k==0 else 0
    def case(name, jitter):
        blocks=[]
        for n in range(8):
            z=rng.normal(size=(28,4,4))*jitter
            z=(z+z.transpose(0,2,1))*.5
            blocks.append(exact+z)
        return {"recording":name,"blocks":np.array(blocks),
                "mru_stationary_rms_dps":.08}
    train=[case("train-"+str(i),.001) for i in range(9)]
    test=[case("test-"+str(i),.0015) for i in range(4)]
    predictions,metadata=r.build_models(train)
    if not metadata["conditional_variances_nonnegative"]:
        raise AssertionError("positive synthetic conditional variance rejected")
    measured=r.evaluate(predictions,test)
    gain=measured["candidate_vs_contrast_relative_gain"]
    if gain is None or gain<.80:
        raise AssertionError(f"shared-noise model failed to beat blinded contrast-only under true shared error: {gain}")
    if not measured["candidate_lag0_ratios_in_band"]:
        raise AssertionError("exact source synthetic covariance calibration ratio failed")
    if measured["mrup_stationarity_refusal"]:
        raise AssertionError("independent stationary reference unexpectedly fails")
    if measured["recordings"]!=4 or measured["recording_bootstrap_draws"]!=2000:
        raise AssertionError("original 4-recording/2000-bootstrap protocol mutated")

    # A genuine independent-only null should not spontaneously grow shared
    # error. We measure covariance-prediction error on a second untouched draw.
    independent=exact.copy()
    for k in range(28):
        for i,j in r.COMBINATIONS:
            independent[k,i,j]=independent[k,j,i]=0
            if k==0:
                independent[k,i,i]-=common[0]
                independent[k,j,j]-=common[0]
    if np.max(np.abs(independent[:,0,1]))!=0:
        raise AssertionError("independent source has nonzero shared covariance")

    # The five-sensor all-common direction is an *exact* nullspace for
    # every pair-contrast even with the MRU; a rank claim cannot erase it.
    graph=np.array([np.eye(5)[i]-np.eye(5)[j] for i,j in
                    ((0,1),(0,2),(0,3),(0,4),(1,4),(2,4),(3,4))])
    if not np.array_equal(graph@np.ones(5),np.zeros(len(graph))):
        raise AssertionError("common-mode identifiable from pair contrasts")
    if np.linalg.matrix_rank(graph)!=4:
        raise AssertionError("five-sensor difference graph rank changed")

    # A held-out counterexample must not alter a source-only fitted model.
    altered=[{"recording":v["recording"],"blocks":v["blocks"].copy(),
             "mru_stationary_rms_dps":v["mru_stationary_rms_dps"]} for v in test]
    for v in altered: v["blocks"][:,0,0,0]*=100
    repeat,_=r.build_models(train)
    if any(not np.array_equal(predictions[k],repeat[k]) for k in predictions):
        raise AssertionError("final test affected source-only model parameters")
    altered_scores=r.evaluate(predictions,altered)
    if altered_scores["methods"]["reference_shared"]["mean_normalized_mse"]==measured["methods"]["reference_shared"]["mean_normalized_mse"]:
        raise AssertionError("heldout metric ignored changed samples")

    # The normalization is undefined for perfectly duplicated sensors;
    # the actual full receiver must raise, never divide by epsilon.
    degenerate=[{"recording":"zero","blocks":np.zeros((8,28,4,4)),
                 "mru_stationary_rms_dps":.0}]
    try:
        r.evaluate(predictions,degenerate)
    except RuntimeError as exc:
        if "normalizer" not in str(exc):
            raise
    else:
        raise AssertionError("zero-variance phantom certainty not refused")
    return {"synthetic_shared_vs_contrast_gain":gain,
       "source_only_model_fixed_under_heldout_mutation":True,
       "nullspace_rank":4,"nullspace_dimension":1,
       "negative_zero_variance_refusal":True,
       "heldout_four_recordings":4,
       "candidate_mse":measured["methods"]["reference_shared"]["mean_normalized_mse"],
       "contrast_only_mse":measured["methods"]["contrast_only"]["mean_normalized_mse"]}


if __name__=="__main__":
    print(json.dumps(synthetic(),sort_keys=True))
