#!/usr/bin/env bash
set -euo pipefail
export TMPDIR=/workspace/tmp
mkdir -p "$TMPDIR"
node --version
git rev-parse HEAD
node --test tests/trajectory-adaptive-gaussian-sensor.test.mjs \
  > "$TMPDIR/adaptive-eig-preflight.log" 2>&1 || {
    tail -100 "$TMPDIR/adaptive-eig-preflight.log"
    exit 1
  }
tail -16 "$TMPDIR/adaptive-eig-preflight.log"
node experiments/adaptive-sensor-eig-receiver.mjs \
  > "$TMPDIR/adaptive-eig-frozen-receiver.json"
node --input-type=module -e '
import {readFileSync} from "node:fs";
const r=JSON.parse(readFileSync(process.env.TMPDIR+"/adaptive-eig-frozen-receiver.json","utf8"));
console.log(JSON.stringify({
  schema:r.schema,
  adaptive:r.adaptiveOverall,
  allFixed:r.allSixFixedSchedules,
  posthocBestFixed:r.posthocBestFixedAccuracyDiagnosticOnly,
  adaptiveBeatsAllFixed:r.adaptiveBeatsAllFixedOnTheseParticularSyntheticCohorts,
  cohorts:r.cohorts.map(c=>({
    noise:c.noise,adaptive:c.adaptive,maintained:c.maintainedCorrelated,
    actions:c.adaptiveActions
  }))
},null,2));
'
