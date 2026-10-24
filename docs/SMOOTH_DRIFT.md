# Prospective smooth-baseline drift

The UNKNOWN LAB instrument compares original prospective v2 acquisition plans under an explicitly sourced curvature bound B in N·m per acquisition-index². This is a conditional sensor-baseline family, not a bound inferred from the empirical noise sigma, physical calibration, elapsed-time law, observed correction, or probability. Observed periodic explanation fitting remains a separate investigation.

## Why it changes an experiment choice

In the authored twelve-pair comparison, order 819 suppresses offered periods 3 and 5 to maximum gain 0.043989, but an admissible baseline with B = 0.01 produces contrast 0.02 N·m. Order 1365 has a larger offered periodic gain of 0.186339, yet its worst smooth-baseline contrast is only 0.01 N·m. Their declared worst normalized noise variances are 0.227509 and 0.166667. These are separate conditional quantities; no combined score or automatic winner is supplied.

## Model and independent witness

For original signed contrast weights wᵢ and acquisition indices xᵢ, the maintained adjacent AB/BA admission gives Σwᵢ = Σwᵢxᵢ = 0, including unequal AB and BA counts. Thus any affine baseline cancels. If f′ is absolutely continuous and |f″| ≤ B almost everywhere, the contrast is the integral of f″ against

`K(t) = Σ wᵢ max(0, xᵢ − t)`.

Its exact-real worst absolute response is `B ∫ |K(t)| dt`. The kernel is piecewise linear; all original-index endpoints and interior zero crossings are retained. The displayed baseline starts with f = f′ = 0 and uses f″ = B sign(K), making it piecewise quadratic with continuous slope. Its actual sampled signed contrast is independently accumulated and compared with the kernel result. Adding any affine baseline leaves the contrast unchanged. This attaining authored baseline demonstrates the assumed family; it is not an observed instrument trace.

The implementation reuses maintained v2 admission, signed weights, noise covariance, and periodic gain. Integer kernel numerators with common denominator 2 nAB nBA preserve affine cancellation before division. Existing limits of 128 pairs and span at most one million keep the integer sums within JavaScript's exact integer range. Areas, crossing locations, and integrated baseline values use floating-point arithmetic. A magnitude-scaled engineering allowance qualifies direct witness receiving; it is not a certified enclosure. `unresolved-arithmetic` remains visible if the witness residual exceeds that allowance.

Independent research controls use Python Fraction arithmetic to construct exact support-attaining witnesses for all 1,246 balanced 8-, 10-, and 12-pair orders, plus 100 unequal-stratum, gapped, large-origin schedules. Core tests include an independent fine-grid kernel integral, bounded sinusoidal curvature, affine/quadratic controls, zero B, immutable inputs, malformed contracts, and complete replay. A peer independently exercised extreme 4-versus-rest strata, 128-pair/high-span schedules and B = 1000. Large spans can produce a conservative allowance, which remains visible instead of being promoted to physical certainty.

## Two actual visual compositions

The consumer includes a compact sensitivity-bar view and a linked kernel/attaining-baseline view. Bars compare conditional quantities separately and reveal tradeoffs quickly, but cannot explain where a false contrast comes from. The default linked view makes the signed acquisition sequence inspectable: a shared sample slider highlights the same original index in both plots and reports baseline value, signed weight and contribution. Teal denotes positive kernel or conditioned readings; pink denotes negative kernel or reference readings. The plots sit side by side on desktop and stack on narrow displays.

Original inputs stay editable in a disclosure; an authored-example action opens the research control directly. Download saves the original v2 plans and sourced curvature declaration. Reopening recomputes every result; editing inputs invalidates the display and cancels pending adoption of a file or example. The browser receiver exercises both visual concepts, keyboard selection, changed order and zero curvature, download/reopen, delayed-file invalidation, and narrow layout, saving actual screenshots for review.

## Authored-example receiving correction

Actual browser receiving found that the maintained server allowed only three older example JSON paths. Both the new drift example button and the previously merged period-band example button therefore received 404. The server now explicitly allows only `examples/smooth-drift.json` and `examples/period-bands.json` in addition to its existing routes. File import and input-only replay are unchanged. A native HTTP test compares returned bytes with both original source files, checks HEAD behavior, and confirms unrelated files remain blocked. Both actual browser receivers click the authored-example buttons; failure receipts include page status, application errors, exceptions, and a screenshot.

## Integrated qualification

The final current-source composition preserves main `93130ac6d5dd96ce9c4cd028d0178a82328eccb5`, including the motion-reference server routes and newer coupling work. Node 22.23.4 executed **690 native tests: 690 passed, zero failed or skipped**, with the maintained Playwright module supplied so the optional portability course also ran. The actual sandboxed Chrome 156 smooth-drift receiver passed eight workflow groups; the period-band receiver passed nine groups including its authored-example action. Neither browser course reported page exceptions.

The two desktop visual concepts and the 390 px stacked instrument were inspected in actual browser screenshots. [Verification and source hashes](receipts/smooth-drift-20261024/verification.json), [drift receiving](receipts/smooth-drift-20261024/browser.json), and [period-band example receiving](receipts/smooth-drift-20261024/period-band-browser.json) retain this evidence. Earlier receiving exposed the missing server routes; it was corrected before this candidate was qualified. Normal merge and fresh exact merged consumer receiving are recorded separately in the native PR.
