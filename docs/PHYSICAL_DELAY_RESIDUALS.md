# Inspect errors at declared physical delays

The residual-pair instrument retains sample-index lags and adds an explicit
**Physical-delay bands (seconds)** mode. Enter closed bands as `lower:upper`,
separated by commas. Every original receiving pair whose supplied timestamp
difference lies inside a band is included. No positions, errors or clocks are
interpolated, and the imposed initial row remains excluded.

The same full-receiving mean, centered cosine and squared-difference ratio are
used for both pairing modes. On an exactly uniform dyadic clock, an exact delay
band yields exactly the original sample-lag pair identities and statistics.
On irregular clocks, delay bands answer a different question from sample lag:
they compare errors across the specified elapsed separation. They do not
estimate a physical period or frequency, authenticate independence, enclose
clock error or infer a cause of model discrepancy.

Band limits apply to supplied binary64 timestamp differences. Empty bands and
single-pair bands remain visible; neither defines a correlation. Overlapping
bands may repeat original pairs, and each use counts toward the complete work
budget. Exceeding that budget refuses the whole requested population.

## Inspecting large cohorts

Physical-delay cohorts can contain many more pairs than a single sample lag.
The browser exposes explicit200 pair pages in both the scatter and original-row
ledger, with a direct page selector and displayed original pair range/total.
Every pair remains accessible. Axis bounds and statistics always use the complete
cohort; the displayed page does not change them. Original timestamps, observed
angles, predicted angles and errors retain round-trippable text.

The alternative of drawing all pairs and ledger rows at once was rejected after
an admitted79401 pair control exposed both JavaScript argument limits and excessive
DOM size. Stable/scalable norm and extrema operations remove the argument limit;
explicit paging bounds rendered nodes without silently thinning evidence.

## Qualification so far

- Five selector groups, including500 irregular/large-epoch exhaustive membership
  courses; independently reviewed decimal, one-ULP and subnormal boundaries.
- Six consumer groups: exact incumbent sample-mode output, matching dyadic-clock
  pair populations, empty/single handling, copied source custody, full overlapping
  budget refusal and a100576 pair numerical-capacity regression.
- All seven original residual diagnostic groups remain green.
- Independent source review and simulated-DOM execution of the actual panel
  handlers at79401 pairs confirm200 rows on the first page,398 page choices, and
  exact final original pair[398,399] on the last page, with edit invalidation.

The actual-browser harness `scripts/physical-delay-browser.mjs` is prepared but
not yet executed. It receives the maintained solver source, switches pairing
modes, challenges malformed bands, inspects the high-count first/last pages,
retains empty/single cases and captures desktop/narrow output under verified
Chrome sandbox status. Source or simulated-DOM checks are not browser acceptance,
merged source, deployment or physical validation.
