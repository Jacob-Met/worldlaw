# Receive a frozen reference-model request

The reference-model comparison now lets an investigator freeze one offered condition before importing its separately supplied main and reference notebooks. Freezing explicitly uses only marked training runs; existing challenge runs are excluded and never relabeled. The original comparison remains available.

The request stores original training inputs, gain/amplitude bounds, the finite tau list, the selected duration/reference interval/main radius, a request identifier, and a prospective declaration. No cached predictions or fitted polygons are saved. Reopening recomputes the maintained comparison. In-memory requests are recursively frozen. Supported requested duration is positive through 30 seconds, matching the maintained acquisition receiver; training plus actual outcomes must fit its 12-run bound.

An actual acquisition file has schema `worldlaw.reference-model-acquisition/v1`, the complete saved `request` object, and a `runs` array. Each run is a maintained reference-channel challenge with its own identity, requested duration, and main/reference acquisition IDs and original paired-history notebooks. The consumer requires the full request source to match, rather than relying on an identifier alone. This is source binding, not authentication of acquisition identity or timing.

The receiving account uses schema `worldlaw.reference-model-receiving/v1`, with `request` and an explicit `outcomes` array. The same source-only file represents both a frozen request with no outcomes and an account with received observations. A missing outcomes field is refused rather than silently clearing evidence. Duplicate acquisition identities, recycled recordings and mixed measured/synthetic investigations retain the maintained admission rules.

## Two separate findings

* Offer achievement requires a qualified acquisition order, the entire actual reference interval inside the anticipated reference interval, and an actual main radius no larger than the offered radius. These checks use computed binary64 endpoints; they are not calibrated uncertainty or physical-control guarantees.
* Model compatibility uses the actual channel intervals. All order-qualified observations constrain the same originally admitted gain/amplitude polygons jointly, even when the offered reference condition or precision was missed. Failed offers stay visible and exportable. Unqualified order evidence is retained but does not constrain the hypotheses, and cannot conceal an existing contradiction.

No new tau, response rule or coefficient bound is introduced during receiving. Every row must share one coherent coefficient hypothesis. Zero-amplitude nesting and weak-reference overlap remain possible. The inherited binary64 exponential/clipping screen is not certified interval arithmetic; the original reference-insensitivity, shared-artifact and stable-gain assumptions remain conditional.

## Source changes and recovery

Parent/comparison edits cancel pending file reads and label an accepted account stale relative to current controls. They do not erase its frozen training, original actual outcomes or export. Explicit freeze/reopen replaces an accepted account only after the whole replacement validates. A failed replacement leaves accepted evidence intact. The frozen-source banner distinguishes that account from live parent controls.

## Receiving

Run `node test-request.mjs` for the authored analytic controls. Run `BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome BROWSER_ARTIFACT_DIR=<owned-output> node scripts/reference-request-browser.mjs` with an installed, normally sandboxed browser. The browser course includes the maintained comparison journey, actual request export and fresh-page reopen, supplied actual channels, offer failures, source mismatch refusal, and delayed-import/stale-account behavior. Actual receipts and independent review must accompany publication; this document does not assert physical validation.
