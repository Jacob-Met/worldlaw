# Initial browser admission failure

Root broker reported the initial Chrome 156 run failed before product interaction: the receiver expected `Namespace sandbox Yes`, while actual `chrome://sandbox` reported:

```
Layer 1 Sandbox Namespace
PID namespaces Yes
Network namespaces Yes
Seccomp-BPF sandbox Yes
Seccomp-BPF sandbox supports TSYNC Yes
You are adequately sandboxed.
```

This is a receiver parser failure, not a passing product run. Root retains the full execution output in its remote receiving artifacts. The updated receiver saves complete observed sandbox text before asserting each of these actual admission fields, including PID/network namespace, Seccomp-BPF and TSYNC. No sandbox requirement was removed. A fresh browser run remains required.

Concurrent brokered Node 22 result: 579 tests, 578 passed, zero failed, one skip (skip reason pending broker identification). Composed parent: 20f252133f08630d24950bd7d1afa46756f7013c. These are root-reported results, not independently repeated by this worker.
