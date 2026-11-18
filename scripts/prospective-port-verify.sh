#!/usr/bin/env bash
set -euo pipefail
echo "WORLDLAW prospective intervention — cold verifier"
echo "SOURCE=$(git rev-parse HEAD)"
node --version
node --test tests/prospective-port.test.mjs tests/actuator-port.test.mjs
npm run smoke
npm run smoke:trajectory
