---
license: mit
pretty_name: Neural Actuation Dataset (NAD)
task_categories:
- robotics
tags:
- robotics
- actuators
- system-identification
- force-estimation
- differentiable-simulation
- video
size_categories:
- 100K<n<1M
configs:
- config_name: omx
  data_files:
  - split: train
    path: parquet/omx/train.parquet
  - split: validation
    path: parquet/omx/validation.parquet
  - split: test
    path: parquet/omx/test.parquet
- config_name: so101
  data_files:
  - split: train
    path: parquet/so101/train.parquet
  - split: validation
    path: parquet/so101/validation.parquet
  - split: test
    path: parquet/so101/test.parquet
- config_name: franka
  data_files:
  - split: train
    path: parquet/franka/train.parquet
  - split: test
    path: parquet/franka/test.parquet
---

# Neural Actuation Dataset (NAD)

Actuator telemetry recorded on two low-cost servo-driven robot arms, released with the
RSS 2026 paper *NeuralActuator: Neural Actuation Modeling for Robot Dynamics and
External Force Perception*. Each trajectory logs commanded positions, joint positions,
currents, velocities, temperatures and voltages at the servo telemetry rate, plus
end-effector force ground truth where available. The dataset supports actuator system
identification through differentiable simulation, sensorless external-force estimation,
and motor-condition detection.

- **OpenManipulator-X** (Dynamixel XM430-W350 servos): 35 tasks, 350 trajectories,
  ~319k frames (~90 minutes) at ~58.8 Hz.
- **SO-101** (Feetech STS3215 servos, LeRobot ecosystem): 10 task-payload
  combinations, 100 trajectories, ~66k frames (~18 minutes) at ~62.3 Hz.
- **Franka Panda** (joint torque sensors, libfranka): 1 lift-and-hold task with
  5 payloads x 7 trials, 35 trajectories, ~33k frames (~9 minutes) at 62.5 Hz.

485 trajectories in total. Every OMX and SO-101 task directory contains 8 training,
1 validation and 1 test trajectory (`train/001.csv` ... `train/008.csv`,
`validation/001.csv`, `test/001.csv`). Validation and test trajectories are held-out
repetitions of the same commanded trajectory as the training files; the on-disk split
is used as-is by all configs in the code release. The Franka subset ships 6 training
and 1 test trial per payload. 430 of the trajectories also have a camera recording of
the collection session under `videos/` (see [Videos](#videos)).

- Code, configs and pretrained checkpoints:
  [github.com/Frank-ZY-Dou/Dynamics-Modeling/tree/main/NeuralActuator](https://github.com/Frank-ZY-Dou/Dynamics-Modeling/tree/main/NeuralActuator)
- Project page:
  [frank-zy-dou.github.io/projects/NeuralActuator](https://frank-zy-dou.github.io/projects/NeuralActuator/index.html)

## Directory layout

The canonical form of the dataset is the raw CSV tree under `data/`, identical to the
`data/` directory of the GitHub release:

```
data/
  force_unlabeled/            # OMX free motion, 10 tasks
    backward_forward/{train,validation,test}/*.csv
    circular_cw/  circular_ccw/  go_up_and_stay_still/
    joint_sweep_motor11/ ... joint_sweep_motor15/
    pick_place_empty/
  force_sensor/               # OMX end-effector pushes, 12 tasks
    force_x_plus/  force_x_minus/  force_y_plus/  ...  force_z_minus/
    force_x_plus_ref/  ...  force_z_minus_ref/        # matched no-contact references
  weight/                     # OMX payload tasks, 9 tasks
    go_up_and_stay_still_no_force/
    go_up_and_stay_still_with_object_{200g,300g,400g}/
    pick_place_no_force/
    pick_place_object_{200g,300g,400g,500g}/
  motor_condition/            # OMX normal vs degraded joint 3, 4 tasks
    pick_place_empty/  pick_place_empty_degrade/
    pick_place_object_200g/  pick_place_object_200g_degrade/
  so101/                      # SO-101, task x payload
    go_up_and_stay_still/{empty,200g,300g,400g,500g}/{train,validation,test}/*.csv
    pick_and_place/{empty,200g,300g,400g,500g}/{train,validation,test}/*.csv
  franka/                     # Franka Panda, lift-and-hold payloads
    lift_hold/{train,test}/<payload_g>_<trial>.csv
```

The `parquet/` directory holds the same rows repacked per platform for the dataset
viewer and `load_dataset` (see [Usage](#usage)); the CSVs remain the reference format.
Camera recordings of the collection sessions live under `videos/`, mirroring the
`data/` tree (see [Videos](#videos)).

## OpenManipulator-X CSVs

44 columns per row, one row per telemetry sample (~58.8 Hz; the release configs assume
a 17 ms step, `data_dt: 0.017`). The follower arm mirrors a hand-moved leader;
`goal_*` columns are the leader commands sent to the follower, everything else is
follower telemetry.

| Columns | Unit | Description |
|---|---|---|
| `timestamp` | s | Time since recording start |
| `pos1`-`pos5` | rad | Joint positions (joint 5 is the gripper motor) |
| `aperture` | mm | Gripper opening width, derived from `pos5` |
| `goal_pos1`-`goal_pos5` | rad | Commanded joint positions (leader) |
| `goal_aperture` | mm | Commanded gripper opening, derived from `goal_pos5` |
| `current1`-`current5` | mA | Motor currents |
| `vel1`-`vel5` | rad/s | Joint velocities |
| `temp1`-`temp5` | C | Motor temperatures |
| `pwm1`-`pwm5` | counts | Signed XM430 PWM duty register |
| `volts1`-`volts5` | V | Bus voltages |
| `force_x`, `force_y`, `force_z` | N | External force at the end effector (see below) |
| `force_gripper_x/y/z` | N | Reserved; all zero in the released data |

What the force channels contain depends on the subset:

| Subset | Force channels |
|---|---|
| `force_unlabeled` | `-999` throughout (no sensor attached) |
| `force_sensor`, push directions | 6-axis F/T sensor reading on all three axes |
| `force_sensor`, `*_ref` | `-999` throughout (no-contact reference runs) |
| `weight` | `force_z` = payload weight (e.g. -4.9 N for 500 g) while the object is held, `-999` otherwise; `force_x/y` always `-999` |
| `motor_condition` | as `weight`: the 200 g tasks carry the `force_z` payload label, the empty tasks are `-999` throughout |

## SO-101 CSVs

46 columns per row at ~62.3 Hz (`data_dt: 0.01605` in the release config). Six joints;
the jaw is joint 6, so there are no separate gripper/aperture columns. Servo telemetry
is kept in raw STS3215 register units.

| Columns | Unit | Description |
|---|---|---|
| `timestamp` | s | Time since recording start |
| `pos1`-`pos6` | rad | Joint positions |
| `goal_pos1`-`goal_pos6` | rad | Commanded joint positions (leader) |
| `current1`-`current6` | counts | Current register (unused by the released configs) |
| `vel1`-`vel6` | steps/s | Velocity in encoder steps per second (4096 steps/rev) |
| `load1`-`load6` | counts | Signed load register; this is the "current" feature the released configs read (`current_source: load`) |
| `temp1`-`temp6` | C | Motor temperatures |
| `volts1`-`volts6` | dV | Bus voltage in decivolts (e.g. 122 = 12.2 V) |
| `force_x`, `force_y`, `force_z` | N | Weight-derived force label (see below) |

The SO-101 rig has no end-effector force sensor. Force labels are derived from the
known payload weight: `force_z` equals the payload weight (e.g. -2.94 N for 300 g)
while the object is held and `-999` otherwise; `force_x` and `force_y` are `-999`
throughout.

## Franka Panda CSVs

72 columns per row at 62.5 Hz (`data_dt: 0.016` in the release config). Seven revolute
arm joints plus a parallel-jaw gripper; all quantities come from the libfranka robot
state at the arm's control interface. Files are named `<payload_g>_<trial>.csv`
(e.g. `400_003.csv` = 400 g payload, trial 3); the payload weight is parsed from the
filename to synthesize the training force label `[0, 0, -mg]`.

| Columns | Unit | Description |
|---|---|---|
| `timestamp` | s | Time since recording start |
| `pos1`-`pos7` | rad | Joint positions (link side) |
| `gripper_width` | - | Gripper opening, normalized to [0, 1] (finger travel 0-0.04 m) |
| `vel1`-`vel7` | rad/s | Joint velocities (link side) |
| `vel_d1`-`vel_d7` | rad/s | Commanded joint velocities |
| `tau_d1`-`tau_d7` | Nm | Commanded joint torques (controller output) |
| `tau1`-`tau7` | Nm | Measured joint torques from the link-side torque sensors |
| `tau_ext1`-`tau_ext7` | Nm | Estimated external joint torques |
| `cmd_pos1`-`cmd_pos7` | rad | Commanded position setpoints (step function, 2-3 setpoints per trial) |
| `motor_pos1`-`motor_pos7` | rad | Motor-side positions |
| `motor_vel1`-`motor_vel7` | rad/s | Motor-side velocities |
| `force_x`, `force_y`, `force_z` | N | Weight-derived force label |
| `torque_ext_x/y/z` | Nm | Estimated external torque at the end effector |
| `lifting` | 0/1 | Payload-held flag (1 throughout the released trials) |

As on the SO-101, there is no end-effector force sensor: `force_z` equals the payload
weight for the whole recording (the object is held throughout) while `force_x` and
`force_y` are `-999` throughout. The measured torques `tau1`-`tau7` provide a per-joint
torque reference for work that needs one; the released pipelines do not consume them.

## Sentinel convention

The force channels use `-999` as a sentinel for frames without a force reading. The
OMX loaders in the code release map `-999` to 0 N at load time (frames without a
reading are treated as zero external force); the SO-101 config instead sets
`mask_invalid_force: true`, which excludes `-999` frames from the force loss. Handle
the sentinel before feeding the force columns to anything numeric.

## Collection hardware

The trajectories were recorded on twin leader/follower rigs: a human moves the leader
arm by hand and the follower replays the commanded positions while its servo telemetry
is logged over U2D2 USB adapters (OMX) or the LeRobot serial bus (SO-101); the Franka
trajectories are logged directly from the libfranka robot state during scripted
lift-and-hold executions. Force ground
truth for the `force_sensor` subset comes from a 6-axis force/torque sensor at the
end effector (internal lab equipment); pushes were applied with a BAOSHISHAN ZP-500N
digital force gauge, and the payload tasks use standard 100-500 g calibration weights.
The full component list with sourcing links, wiring, motor IDs and PID settings is in
the [Hardware](https://github.com/Frank-ZY-Dou/Dynamics-Modeling/tree/main/NeuralActuator#hardware)
section and `teleop/README.md` of the GitHub release.

## Videos

The collection sessions were filmed with a fixed camera facing the follower arm and
its workspace. The recordings are under `videos/`, one MP4 per trajectory, at the same
relative path as the trajectory's CSV: `videos/omx/<subset>/<task>/<split>/NNN.mp4`
shows the session logged in `data/<subset>/<task>/<split>/NNN.csv`, and likewise
`videos/so101/<task>/<payload>/<split>/NNN.mp4` for the SO-101 trajectories.

| Platform | Videos | Format | Total size |
|---|---|---|---|
| `videos/omx/` | 330 (33 of 35 tasks) | H.264 MP4, 1706x1440, 24 fps | 2.5 GiB |
| `videos/so101/` | 100 (all 10 task-payload combinations) | H.264 MP4, 1280x1440, 30 fps | 362 MiB |

Coverage: 430 of the 450 trajectories have a video. The 20 trajectories of the two
no-payload weight tasks (`weight/go_up_and_stay_still_no_force`,
`weight/pick_place_no_force`) have no recording; every other released trajectory has
exactly one video with the matching filename.

Video and CSV cover the same session but are not frame-synchronized: the camera was
started and stopped independently of the telemetry logger, so video durations differ
from the logs by up to a few seconds on OMX (typically under one second on SO-101).
Use the videos to see what a trajectory did; they are not an aligned camera modality.

The videos add ~2.9 GiB to a full `snapshot_download`. Use
`allow_patterns="videos/**"` to fetch them alone, or `ignore_patterns="videos/**"`
to skip them.

## Usage

The raw CSV tree is the canonical format and is what the training and evaluation
scripts in the GitHub release consume. To fetch it and load a trajectory:

```python
import pandas as pd
from huggingface_hub import snapshot_download

root = snapshot_download("frankzydou/NAD", repo_type="dataset")
df = pd.read_csv(f"{root}/data/weight/pick_place_object_500g/test/001.csv")
```

`snapshot_download(..., allow_patterns="data/**")` fetches only the CSVs. Pointing the
release configs' data paths at the downloaded `data/` directory reproduces the paper
benchmarks; the GitHub README maps each subset to its config and results table.

The parquet packing loads natively, one config per platform (schemas differ), with
`subset`/`task`/`payload`/`trajectory` columns identifying the source file of each row:

```python
from datasets import load_dataset

omx = load_dataset("frankzydou/NAD", "omx")      # splits: train/validation/test
so101 = load_dataset("frankzydou/NAD", "so101")
```

Rows within a trajectory are consecutive and in time order; group by
(`subset`, `task`, `trajectory`) for OMX or (`task`, `payload`, `trajectory`) for
SO-101 to recover whole trajectories.

## License

The dataset is released under the MIT license, the same license as the code release.

## Citation

```bibtex
@inproceedings{dou2026neuralactuator,
  title     = {{NeuralActuator}: Neural Actuation Modeling for Robot Dynamics and External Force Perception},
  author    = {Dou, Zhiyang and Onyemelukwe, John U. and Zhang, Hangxing and Zhang, Heng and Guo, Minghao and Tian, Yunsheng and Lipiec, Michal Piotr and Jacob, Joshua and Liu, Chao and Chen, Peter Yichen and Ivanov, Yuri and Matusik, Wojciech},
  booktitle = {Proceedings of Robotics: Science and Systems (RSS)},
  year      = {2026}
}
```
