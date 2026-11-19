# Fleet-compatible thin adapter to the maintained Node verifier.
# No generated output or dependencies are committed.
.PHONY: verify test-gaussian

verify:
	npm run verify

test-gaussian:
	node --test tests/trajectory-gaussian-discriminator.test.mjs tests/trajectory-planner-92be.test.mjs

# Original MAGF-ID Conf2 preregistered science; never parse target in unit tests.
# CPU fleet only; generated venv and caches stay under /workspace.
.PHONY: magfid-reference-selftest
magfid-reference-selftest:
	@set -eu; mkdir -p /workspace/tmp; T=$$(mktemp -d /workspace/tmp/worldlaw-conf2-unit-XXXXXX); trap 'rm -rf "$$T"' EXIT; \
	python3 -m venv "$$T/venv"; \
	"$$T/venv/bin/python" -m pip install -q --disable-pip-version-check numpy==1.26.4; \
	OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 \
	"$$T/venv/bin/python" experiments/magfid_reference.py selftest
