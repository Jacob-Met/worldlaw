# Continuous Mainline Product Delivery Contract

**User directive — October 18, 2026.** This is a companion to [Creative Autonomy Charter](CREATIVE_AUTONOMY_CHARTER.md), [Implementation Fabric](IMPLEMENTATION_FABRIC.md), and the complete per-product blueprints.

## Prime invariant

> **Every project's `main` is always a complete, runnable package of everything that has been demonstrated and accepted so far. Creative ambition has no arbitrary ceiling, and integration has no permission to wait until the entire final vision is finished.**

**Do not confuse two different states.**
- `main` is **shippable at its current demonstrated capability level**: complete package, real entry point, buildable and runnable, supported flows internally consistent, no newly broken old experiences, and the last accepted real-input golden path preserved.
- The **ultimate product** remains unfinished until every preserved original user benefit and all adopted extensions are fully realized and independently demonstrated. A releasable current package is never a claim that the full visionary end-state has been achieved.

Early initialized repositories may not yet have a working product. Their first priority is to establish the smallest honest *integrated* executable baseline, with visible unimplemented states; they must never claim release-qualified before this gate is met.

## Mandatory workflow for all active projects

1. **A single integration owner is accountable for `main`.** Many agents research and implement concurrently in independent branches/worktrees/machines. The integrator does not monopolize contributions; they are responsible for maintaining the runnable application.
2. **Merge continuous vertical increments.** A new backend schema, native component, feature, model, design system, asset, test or UI control merges promptly when it has a real consumer or harmless compatible adapter and passes relevant receiving. Avoid weeks-long, unmergeable feature branches. Break large inventions into mergeable steps without weakening the final vision.
3. **Hide incomplete experiences, not the engineering progress.** Use feature flags, experimental routes, capability negotiation, optional model backends, progressive enhancement, or private preview builds. Production/default user routes must neither display stubs as finished features nor break when experimental dependencies are unavailable.
4. **Keep compatibility explicit.** Use versioned interchange, adapters and migration for data formats, save files, model outputs, provider contracts, world-state and persistence. A transition can land in several incremental commits, with both old and new readers where necessary; remove deprecated paths only after end-to-end receiving.
5. **Every merge includes proof of no regression.** Minimum: code builds/starts from a clean checkout; automated unit and integration tests pass; the established golden path remains operable; important exported artifacts load; any changed UX has a real screenshot/video or browser receiving; dependencies and assets are documented. Heavy GPU/XR/provider requirements get independent qualified runners rather than being marked passing with mocks.
6. **Never turn CI green into an empty ritual.** No `[skip ci]` used as evidence of a passed merge gate. If hosted Actions are disabled, the existing authenticated runner infrastructure runs exact commands at the proposed SHA and posts a verifiable receipt; separate branch protection/config is needed to enforce the required status. A YAML workflow by itself does not establish protection.
7. **On a red main or regression, restore green fast.** Revert or fix the breaking integration, preserve failing input and repro, and continue research branches. Avoid endless patching of a broken default product while users cannot run the current build.
8. **Distinguish stages of each feature**: research, component-qualified, behind-flag integrated, default-on qualified, cross-environment received, product-final received. Track artifacts and the relevant commit. Main may include safely isolated work well before default-on qualification.
9. **Experiment without limits; integrate without chaos.** Product invention is a core agent responsibility. A radically different interaction mode or AI/graphics subsystem can be prototyped on a branch and gradually integrated behind a switch, then made the default when it has won meaningful quality and compatibility tests. New capability may supersede assistant-assumed mechanics while preserving or exceeding the original user promise.
10. **An actual submission is a tagged, reproducible, finished package.** Use a known tested main commit and record artifact hash, video from real running code, model/assets, all platform requirements and official submission receipt. Continue future development on main subject to contest rules, but preserve exact judged submission revisions.

## Increment example: impossible-to-possible without a broken main

**REPLAY FORGE:** Start with the working authored court and MCP path. Separately land a source-time world schema with a unit test and safe adapter; land real camera calibration and player observations behind an opt-in reconstructed mode; land footage-driven roots; land rigged animation and ball state; land director requests and physics-credible alternative plays; each merge leaves the existing viewer runnable. A consumer may select the reconstructed mode **only when its claimed source-backed requirements actually work**. Everything continues toward the 64-section original, plus novel invented features—without ever swapping in a broken default viewer.

**PHANTOM WINDOW:** A robust ordinary video player is always functional. The scene representation, depth recovery, novel-view GPU renderer, temporal motion and occlusion logic merge behind explicit experimental capture paths as they qualify. The new camera mode becomes a default advertised capability only when it really generates consistent new pixels, with uncertainty evident.

**WORLDLAW:** Real mechanism observations, known-family fit, model discovery, active experiments and interactive predictive physics can land as separate independently qualified vertical enhancements of one operating application. Nobody mistakes the available fit-only mode for general law invention.

**DOMINO:** A stable simulator-backed rule editor and event replay works first; causal race discovery, alternative repair search and permitted provider integration are additive, backward-compatible increments. Default behavior continues to execute legitimate user rules.

## Source and code handling

- Per-project `docs/PRODUCT_CANON.md` defines human-desired benefits; the assistant-authored blueprint is **not** a creative ceiling.
- Per-project `docs/PRODUCT_ACCEPTANCE.md` records current working main SHA, exact build/start, clean-run receipt, active features, known limitations, optional experiments, and next full-vision gap.
- Per-project `docs/CREATIVE_FRONTIER.md` continues adding unexpected ambitious directions and records which are proposed, implemented behind a flag, and received as user-visible experiences.
- Every PR explicitly links the capability and the **mainline non-regression evidence**. Its title or body must not claim final product readiness solely due to a successful component test.
- Merge to `main` when the actual integration gate passes, not only when the entire ambitious epic completes. Branch coordination prevents simultaneous conflicts.

## Mandatory PR receiving checklist

- [ ] Fresh checkout has an exact successful build and launch command.
- [ ] Current default complete user journey remains functional, with observable output.
- [ ] Relevant tests and actual integration checks were run at this commit and receipts recorded.
- [ ] New work is already safe and usable, or protected behind a clearly labeled capability/experiment switch.
- [ ] Source/identity/schema/media/migrations work with prior accepted projects and exports.
- [ ] README, versions, new dependencies, assets, and known limitations are accurate.
- [ ] Product's original benefit remains intact or is demonstrably exceeded.
- [ ] Any new radical feature is added to the creative frontier and eventual full-product acceptance.
- [ ] Existing code is merged promptly after these gates; no indefinitely diverging shadow product.

**Operational principle:** The *latest version is always the best usable version so far*. The *ultimate vision keeps getting more extraordinary*. Neither condition cancels the other.
