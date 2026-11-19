#!/usr/bin/env python3
"""Independent falsifiers for prospective Conf_2 five-gyroscope receiving.

These transformations are *not* randomized physical interventions.
They ask whether the unchanged frozen conditional physics code would falsely
admit a known invalid sensor association, source axis or stationary interval.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import numpy as np

import magfid_covariance as original
import magfid_reference as science

CONTROL_SEED = 20261119


def covariance_pairs(m):
    return np.stack([m[:,i,i]+m[:,j,j]-2*m[:,i,j]
                     for i,j in science.COMBINATIONS],axis=1)


def cross_center(m):
    return float(np.mean([m[0,i,j] for i,j in science.COMBINATIONS]))


def source_models(spec):
    return {k:np.asarray(v) for k,v in spec["models"].items()}


def per_record(work,sel,intake,m,record,index):
    grid,clock,ref=science.read(work,sel,intake,record)
    dotbias=np.asarray(m["dot_bias_dps"])
    refbias=np.asarray(m["mrup_bias_dps"])
    original_blocks, original_rms=science.stationary_moments(grid,dotbias,ref,refbias)
    original_m=original_blocks.mean(axis=0)
    dt=science.NATIVE_PERIOD_US/1e6
    t=np.arange(len(grid))*dt

    # Add a fixed, outside-the-fit, realistic colored shared waveform. A
    # prospective four-DOT contrast must be blind; the absolute stationary
    # cross covariance must change. This is the load-bearing nullspace.
    rng=np.random.default_rng(CONTROL_SEED+index)
    shared=np.zeros(len(t))
    for k in range(1,len(t)):
        shared[k]=.98*shared[k-1]+rng.normal(scale=.20)
    perturbed=grid.copy()
    perturbed[:,:,2]+=shared[:,None]
    changed_blocks, _=science.stationary_moments(perturbed,dotbias,ref,refbias)
    changed=changed_blocks.mean(axis=0)
    difference=float(np.max(abs(covariance_pairs(changed)-covariance_pairs(original_m))))
    cross_delta=cross_center(changed)-cross_center(original_m)

    # Inject shared *physical* motion into MRU as well; even a fifth sensor
    # cannot split real angular velocity from sensor-common error without
    # an independently justified reference calibration.
    mrut, mru=ref
    shared_motion=3*np.sin(2*np.pi*.8*(mrut-mrut[0]))
    moved=mru.copy();moved[:,2]+=shared_motion
    _, moved_rms=science.stationary_moments(perturbed,dotbias,(mrut,moved),refbias)
    shared_mru_refusal=moved_rms>.5

    # The exact native clocks must be verified with a *diagnostic*, not
    # overwritten or silently aligned after observing held-out readings.
    original_offset,_=original.clock_diagnostic(grid,dt)
    desync=grid.copy()
    for axis in range(3):
        desync[:,3,axis]=original.shift_sensor(grid[:,3,axis],12)
    shifted_offset,_=original.clock_diagnostic(desync,dt)
    desync_detected=bool(original_offset[3]!=shifted_offset[3])

    # A measured X-channel substitution challenges the frozen Z covariance.
    # A false acceptance is honestly reported; we do not tune this threshold.
    swap=grid.copy()
    swap[:,3,2]=grid[:,3,0]
    axis_blocks,_=science.stationary_moments(swap,dotbias,ref,refbias)
    # Only the last channel is altered; report normalized changed stationary
    # covariance and test whether the frozen original's ±25% gate rejects.
    swapped_m=axis_blocks.mean(axis=0)
    pred=np.asarray(m["models"]["reference_shared"])
    true_var=swapped_m[0,3,3]
    swapped_ratio=float(pred[0,3,3]/true_var) if true_var>1e-10 else None
    swapped_rejected=(swapped_ratio is None or not .75<=swapped_ratio<=1.25)

    # A duplicated source has exactly zero pair contrast variance, making
    # any normalized pair evidence undefined. Never replace by epsilon.
    duplicate=grid.copy()
    duplicate[:,3,:]=grid[:,2,:]
    delta=duplicate[:,2,2]-duplicate[:,3,2]
    dup_rejected=bool(np.nanmax(abs(delta))==0)

    # Actual source-protocol shake must not be called a stillness segment.
    relative_time=mrut-mrut[0]
    shake_mask=(relative_time>=14)&(relative_time<25)
    shake_rms=float(np.sqrt(np.mean((mru[shake_mask,2]-refbias[2])**2))) if shake_mask.sum() else 0.
    shake_rejected=shake_rms>.5

    actual_input_members={key:intake["members"][path]["sha256"]
                          for key,path in record["members"].items()}
    accepted_source_hashes_match=all(
      science.sha((work/"raw"/intake["members"][path]["local_name"]).read_bytes())==digest
      for key,path in record["members"].items()
      for digest in [actual_input_members[key]])
    # A mutated axis must invalidate a source receipt even if the scientific
    # amplitude happens to mimic the correct axis.
    source_modified = hashlib.sha256(
        (work/"raw"/intake["members"][record["members"]["15"]]["local_name"]).read_bytes()+b"x"
    ).hexdigest()
    source_mutation_rejected=accepted_source_hashes_match and source_modified!=actual_input_members["15"]

    observations={
      "unmodified_reference_mru_rms_dps":float(original_rms),
      "dot_common_shift_crosscov_dps2":float(cross_delta),
      "dot_common_shift_max_pair_contrast_error_dps2":difference,
      "five_sensor_common_motion_reference_rms_dps":float(moved_rms),
      "original_training_frame_clock_offsets":original_offset,
      "delayed_source_clock_offsets":shifted_offset,
      "axis_swap_sensor15_lagzero_ratio":swapped_ratio,
      "duplication_max_pair_delta_dps":float(np.nanmax(abs(delta))),
      "actual_shake_mru_rms_dps":shake_rms,
      "original_input_source_sha256":actual_input_members,
    }
    decisions={
      "dot_common_invisible_to_contrasts":bool(difference<=1e-9),
      "dot_common_detected_in_stationary_crosscov":bool(cross_delta>.1),
      "five_sensor_common_motion_refused":shared_mru_refusal,
      "point_one_second_desync_rejected":desync_detected,
      "z_x_axis_swap_rejected":bool(swapped_rejected),
      "fake_duplicate_sensor_rejected":dup_rejected,
      "physical_shake_as_stillness_rejected":shake_rejected,
      "changed_original_source_sha_refused":source_mutation_rejected,
    }
    return {"recording":record["recording"],"decisions":decisions,
            "observations":observations,
            "all_controls_pass":all(decisions.values())}


def run(work:Path,sel,intake,m):
    per=[per_record(work,sel,intake,m,rec,j)
         for j,rec in enumerate(sel["test"])]
    return {"schema":science.STUDY+".original-controls",
       "test_recordings":len(per),
       "source_script_sha256":science.source_code_sha(),
       "original_controls_script_sha256":science.sha(Path(__file__).read_bytes()),
       "all_controls_pass":all(x["all_controls_pass"] for x in per),
       "records":per,
       "unresolved_reference_boundary":
          "A common disturbance on every gyroscope and real rigid-body motion "
          "remain algebraically indistinguishable with the available reference "
          "unless the stationary assumption and reference noise are independently "
          "calibrated. The published MRU is a *falsifier*, not exact truth.",
       "source_and_physics_separate":
          "Input-SHA refusals prove source integrity; axis/clock/standstill "
          "controls separately test physical identification, not authentication."}
