# Notebook autosave across tabs

The Studio keeps one active notebook in browser storage for each local server address. Its ordinary autosave compares that stored text with the exact version this tab last loaded or successfully saved. If another tab has already saved different text, the older tab refuses to overwrite it.

The displayed notebook can still change after that refusal: refitting, recording and undo operate on the notebook open in that tab. The storage status explicitly says those changes have not been saved. **Export the notebook before reloading** to keep that version. Reload then opens the notebook currently retained in browser storage. Keep separate exported files for versions you want to compare; the Studio does not merge their observations or histories automatically.

The comparison also detects a notebook created after this tab opened, an external deletion, and changed text that cannot be parsed. It preserves the exact stored bytes. A detected conflict remains refused for the life of the page, including later autosave attempts. Writes with identical bytes do not create a content conflict.

Unreadable saved notebooks retain the separate recovery workflow: ordinary autosave stays paused, and explicit replacement first archives and reads back the original text. A successful verified replacement establishes the source for subsequent ordinary saves.

## Limits

This detects external changes completed before the pre-save comparison. The browser's separate read and write operations are not an atomic lock: two simultaneous writers can both pass their comparisons before either writes. An intervening change that returns to identical bytes before inspection is also undetectable. Portable exports remain the way to retain independent notebook versions. No acquisition, model, source schema or forecast calculation changes are involved.

## Reproduce the consumer check

Run the focused native checks with:

```sh
node --test tests/notebook-recovery.test.mjs tests/notebook-autosave-conflict.test.mjs
```

Run `node scripts/notebook-autosave-browser.mjs` with the existing optional `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH` and `BROWSER_ARTIFACT_DIR` environment variables. It starts the maintained product server on an ephemeral loopback port and drives the ordinary Studio controls. Linux receiving requires an ordinary user and the maintained active-sandbox check; the script does not disable the browser sandbox.

The receiver creates a 65-row virtual notebook, opens a second tab, and acquires a separate 66th virtual reading in the first tab. It checks that the second tab's refit and undo preserve the first tab's exact stored bytes, that the second tab's unsaved refit can be exported and reopened, and that a fresh visit exports the first tab's actual acquired input. It also checks two tabs opened before the first saved notebook, desktop and narrow warning visibility, keyboard export and reduced-motion presentation. These are controlled synthetic acquisitions, not physical measurements.
