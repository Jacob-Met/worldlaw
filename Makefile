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

.PHONY: test-symbolic-operators
test-symbolic-operators:
	node --test tests/symbolic-operator.test.mjs
	@set -eu; D=$$(mktemp -d); trap 'rm -rf "$$D"' EXIT; \
	git -C "$$D" init -q; \
	git -C "$$D" fetch --quiet --depth=1 --filter=blob:none https://github.com/Jacob-Met/nullgarden.git 628f480528f00aa84e48e73218fb1574fe3be05d; \
	git -C "$$D" show FETCH_HEAD:src/operator-course.mjs > "$$D/source.mjs"; \
	test "$$(git hash-object "$$D/source.mjs")" = 2e1fedb42d12517d8d10b97c5cba5511e5acc19d; \
	node "$$D/source.mjs" > "$$D/course.json"; \
	node scripts/receive-symbolic-operator-course.mjs "$$D/course.json"

# Native generated controls for the continuous acquisition path.
.PHONY: test-continuous-law
test-continuous-law:
	node --test tests/command-cubic-discovery.test.mjs tests/residual-abstention.test.mjs tests/trajectory-continuous-planner.test.mjs tests/trajectory-sindy-discovery.test.mjs tests/trajectory-continuous-instrument.test.mjs tests/forced-weak-discovery.test.mjs tests/trajectory-integral-92be.test.mjs tests/trajectory-continuous-cli.test.mjs

# All maintained tests, real app smokes, then the closed six-world source gate.
# The native worker must retain both requested artifacts, including failed runs.
.PHONY: qualify-continuous-law
qualify-continuous-law:
	node experiments/qualify-continuous-law.mjs

.PHONY: qualify-noisy-field-interventions
qualify-noisy-field-interventions:
	node --test tests/noisy-field-intervention.test.mjs
	node scripts/noisy-field-course.mjs "$${ARTIFACT_DIR:-.}/noisy-field-result.json"
