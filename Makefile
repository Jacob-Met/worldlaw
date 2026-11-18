# Fleet-compatible thin adapter to the maintained Node verifier.
# No generated output or dependencies are committed.
.PHONY: verify test-gaussian

verify:
	npm run verify

test-gaussian:
	node --test tests/trajectory-gaussian-discriminator.test.mjs tests/trajectory-planner-92be.test.mjs
