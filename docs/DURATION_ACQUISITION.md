# Receiving a frozen conditioning-duration experiment

UNKNOWN LAB's existing duration chooser can now freeze an acquisition before a
separately supplied observation file is received. Compute a duration plan, expand
**Freeze a request and receive separate observations**, declare a new run ID and
the preparation/measurement arrangement, then freeze. Download the observation
template and fill its `notebook` with actual paired observations. The template
contains no generated readings and uses a deliberately invalid null noise
assumption until the investigator declares one.

The receiver binds the selected duration, pair count, source classification,
run identity and preparation declaration to the saved request. It recomputes the
complete training-only forecast from the original inputs and refuses changed
forecasts, stale studies, mismatched protocols, different pair counts, and exact
recycled training observations through the maintained duration validator.
Receiving never refits the training hypotheses. Every retained hypothesis keeps
its prediction and is scored using the existing duration comparison, including
all-family contradiction and order-confounded results.

The achieved contrast screening radius is compared with the prospective radius.
Wide observations and insufficiently counterbalanced order are retained as
unqualified acquisitions, rather than dropped or promoted to successful
planned discrimination. The underlying model comparison remains visible; poor
precision does not erase evidence. Declared labels, preparation descriptions and
source classification do not authenticate independent acquisition, preparation
execution or physical causality. The existing finite-family three-standard-error
screen is not calibrated confidence. No hardware is controlled.

**Save acquisition** retains original study inputs, planning settings, the frozen
protocol and forecasts, and any received observation. Reopen recomputes and
checks the request before restoring the original or received study. Derived
scores are not trusted from disk. A source or study edit invalidates the pending
request. Failed imports preserve the current study. Competing asynchronous file
reads are guarded so an older read cannot overwrite a newer operation.

## Experience decision

Two approaches were considered: a separate request dashboard, and an inline
freeze/receive instrument beside the existing duration predictions. The inline
instrument preserves the working training curves, hypothesis comparison and
challenge plot as the scientific object. It exposes request state without making
another disconnected application. It uses the existing apparatus typography,
controls and source labels; further visual redesign is outside this increment.

## Verification

`node --test tests/duration-acquisition.test.mjs` exercises separate acquisition,
all-family contradiction without refitting, poor precision and unbalanced order,
stale/tampered inputs, copied evidence, measured-source semantics and exact
input-only replay. Existing duration and planner tests remain applicable.

`node scripts/duration-acquisition-browser.mjs` launches the real local server
and Chrome using the existing `BROWSER_EXECUTABLE_PATH` and
`BROWSER_ARTIFACT_DIR` conventions. Its receiving course covers keyboard freeze,
wrong-protocol atomic refusal, real File import, no-refit comparison, save and
reopen, wide-evidence retention, desktop/narrow layout and page/network errors.
Executed results and exact published revision belong in the integration receipt;
preparing this script alone is not browser acceptance.
