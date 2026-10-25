# Original measured Franka sensor response

These two CSVs are byte-for-byte author recordings from the NeuralActuator Dataset (NAD), released under MIT according to the included original author dataset card. The card and files are pinned to Hugging Face commit `88838bce278e381a830a71af83e27dfbb1dac414`.

Primary sources:
- https://huggingface.co/datasets/frankzydou/NAD/blob/88838bce278e381a830a71af83e27dfbb1dac414/README.md
- https://huggingface.co/datasets/frankzydou/NAD/resolve/88838bce278e381a830a71af83e27dfbb1dac414/data/franka/lift_hold/train/200_001.csv
- https://huggingface.co/datasets/frankzydou/NAD/resolve/88838bce278e381a830a71af83e27dfbb1dac414/data/franka/lift_hold/test/200_006.csv
- Author code: https://github.com/Frank-ZY-Dou/Dynamics-Modeling/tree/main/NeuralActuator

| Original file | Bytes | SHA-256 |
| --- | ---: | --- |
| train/200_001.csv | 1035168 | df28cc85a20a8a44ce69ec49cd3f8ebcd321f09bb9adb1afb23e0234dd5cdb65 |
| test/200_006.csv | 1020944 | 86d49d30d60821021a6da1a884937f49be601999bba47cda00cb9d3ff7234cf9 |
| README.md (AUTHOR-DATASET-CARD.md) | 13552 | 714e52ccf4255683d90682b940a570b457670a84f5d28bdfbdba61f4d343bbca |

Predetermined joint 4 uses timestamp seconds, pos4 link position radians, vel4 link rate rad/s, tau_d4 controller commanded torque N·m and tau4 measured link-side sensor torque N·m. All 942 training and 929 receiving rows are retained. Every other original column remains in the source CSV; no resampling, filtering or derivative construction occurs.

**Measured link-side sensor torque is not net joint torque.** The seven-joint robot, its controller, other joints, payload and unmodeled state can affect these observations. Fitted algebraic terms are not identified physical coefficients. Predictions condition on the receiving recording's contemporaneous position/rate/command; this is not a prospective command experiment, free-running motion forecast, calibrated torque conversion or causal estimate. No hardware was operated.

Joint4 and these author train/test recordings were chosen before opening raw training. The test recording remained unopened until the maintained response module, all six fitted candidates and options were frozen and actually received in Studio. The historical freeze and source hashes are in `docs/receipts/sensor-response-56bd8a/training-freeze.json`. This repository now contains both files; subsequent reruns reproduce that frozen evaluation and are not new blind tests. Do not use test results to choose a replacement width and call it held-out success.

Original MIT notice retained as `AUTHOR-LICENSE`, retrieved from https://raw.githubusercontent.com/Frank-ZY-Dou/Dynamics-Modeling/main/NeuralActuator/LICENSE . SHA-256: `f7dca68ac5ef25ab25986c9d3eb2b7c386b945b09ea13f668518b566aae427c5`.
