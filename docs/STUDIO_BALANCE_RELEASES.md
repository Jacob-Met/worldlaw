# Studio balance releases

Open the existing Studio, expand **Let the model move**, then **Find a zero-torque release**.
Set the dynamics fixed command and the angle interval (unwrapped radians); inspect
the current law. Each result reports its residual and numerical bracket.
**Release from … rad** copies the exact candidate into Initial angle, sets rate
to zero, and executes the maintained Studio dynamics with the current inertia
and duration. The existing mechanism, trajectory and local response consume it.
No observation or notebook revision is added.

This brings the maintained CLI scanner into the actual experiment workbench.
The alternative of placing another instrument beneath the mechanism was rejected:
it would separate the release action from its command, inertia, duration and
failure states. The adopted compact disclosure lives with those controls.
It uses the existing torque-bench typography and flat ruled rows, with stacked
actions on phones. It has explicit uninspected, changed, refused, no-candidate
and all-terms-zero states.

The scanner is unchanged. Its finite grid can miss tangencies, close pairs and
unsampled oscillations. Floating zeros and numerical brackets are not rigorous
enclosures, physical equilibrium, nonlinear stability or sticking/contact.
A zero residual of the fitted model is not a new measurement. Original notebook
save/reopen remains input based; scans and release controls are session-local.

## Receiving

`node scripts/balance-inspection-browser.mjs` exercises the launched product in
sandboxed Chrome, with Playwright supplied through PLAYWRIGHT_MODULE.
It checks keyboard operation, an independently calculated analytic spring root
at 0.725 rad, exact transfer into actual dynamics without adding evidence, 390px
layout, changed command/law/range retirement, invalid range/cell count, no roots,
refused inertia and the zero-law continuum. The ordinary seven-group browser
golden path also passes. Both supplied courses are explicitly synthetic.

Rendered desktop and phone captures and an actual interaction WebM are published
with the release. The main remaining experience limitation is that the Studio's
large set of existing investigations makes the dynamics section far down the
page; this increment does not reorganize the whole product.

## Observed-coordinate context

Each scan shows the current fitting observations’ angle, command and rate ranges. A candidate explicitly identifies angle, fixed command or zero-rate values outside those ranges before release. Values inside each separate range do not establish that their combination was observed or that the prediction is physically valid. Held-out readings do not extend the fitting-support bounds. Changing source or command retires the old context.
