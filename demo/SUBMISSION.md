# WORLDLAW — Hackathon Submission

## Track
Coding and agentic engineering

## New or Existing
Existing project. Significantly updated: integrated live Nemotron reasoning for physical law candidate proposal (previous versions used only enumeration), added discrete UI redesign with distinct visual identity separate from template defaults, and validated the full end-to-end Nemotron + Nebius Token Factory integration.

## Models Used and Why
`nvidia/nemotron-3-super-120b-a12b` (120B total, 12B active). Selected for reasoning capability + latency balance; 120B Nemotron 3 is appropriate for physics-domain term proposal. Did not benchmark other sizes, so "appropriate" not "optimal."

## Nemotron Output Quality (1-10) & Why
6/10. Model correctly identifies physically plausible terms (spring restoring forces, damping, cubic stiffening) and provides brief rationales. Limitations: no guarantee of globally optimal fits, one-shot proposals vary with temperature, and model never supplies coefficients—the app fits candidates itself. Output is checked before execution; nothing unvetted runs.

## Approach
Out of the box. Prompt design: compact training summary (ranges, 40-row sample, maintained catalog, baseline), request up to 6 term sets. App validates catalog membership and JSON shape, rejects unknowns, fits survivors on training data, shows held-out error as a falsifiability check. User remains the decision-maker.

## Comparison to Other Models
No comparison performed. Nemotron was available; feasibility was priority.

## Most Valuable Nebius Capability and How
Token Factory OpenAI-compatible endpoint + API key gating. Valuable: eliminates infrastructure complexity, reuses familiar /chat/completions shape, secure key-to-server handoff (browser never sees key), and stateless calls fit the interactive science loop. No local deployment or custom containers needed.

## Recommend Score (1-10) & Why
7/10. Product end-to-end works: observations → Nemotron proposal → app validation → held-out error check → interactive refinement. Design is coherent and distinct from generic templates. Nemotron integration is real (live Nebius call), tested, and checked. Limitations: single-call reasoning (not iterative), user must provide good training data, and held-out set is required for error reporting. No claims beyond what's delivered.

## Experience Score (1-10) & Why
7/10. Clean, dark-themed workbench UI with distinct graphite styling (not default template). Buttons, panels, and layouts are purpose-built for torque-discovery workflow. Motion Lab and Coupling Lab are functional but visually subordinate. Main screen shows candidate laws side-by-side with training and held-out error, enabling direct comparison. Responsive to narrow screens. No performance bottlenecks observed in testing.

## Improvements Wanted
Interactive refinement: allow the app to refine candidate proposals based on which held-out errors were smallest, narrowing the search space. Multi-call reasoning: let Nemotron iterate given app feedback. Physics transfer: test models on unfamiliar mechanisms and learn invariant structure. Automated experiment design: suggest the most informative next measurement.

## What You Hope to See Next from Nemotron
Structured output modes: JSON schema enforcement so candidates always validate without parsing fallback. Chain-of-thought transparency: expose reasoning steps so users see *why* a term was proposed. Batch proposals: request 100 candidates in one call, ranked by model confidence. Multi-turn reasoning: iterative hypothesis refinement where each round reads the app's fit quality.

## AI Tools Used While Building
Claude Code (integrated IDE, continuous build/test/demo rendering). No diffusion, no Blender, no external pretrained weights beyond Nemotron itself.

## About the Project

**Inspiration & Problem**
Physical scientists observe unfamiliar mechanisms and build executable explanatory models. This is slow, iterative, and requires both domain intuition and numerical skill. WORLDLAW automates the inner loop: given observations, propose candidate laws, falsify weak ones experimentally, and improve predictions. The bottleneck was *idea generation*—enumerating all subsets of a feature library is combinatorial. Nemotron bridges that: it proposes physically plausible term combinations and provides brief reasoning.

**What It Does**
1. **Studio**: Import torque measurements (command, angle, velocity). Compare competing law hypotheses. Designate a measurement as held-out validation.
2. **Feature Library**: Maintain a physics-informed catalog (spring restoring, viscous damping, Coulomb friction, cubic stiffening, etc.). Enumerate candidate laws or ask Nemotron for proposals.
3. **Propose**: Press "Ask Nemotron." The server sends Nebius Token Factory a compact summary of your data. Nemotron returns up to 6 term sets + rationales.
4. **Validate**: App fits each proposal on training data, computes held-out error, and displays results ranked by training RMSE. You choose whether to accept or refine.
5. **Experiment**: Select an informative input (Probe Course, two-state readout) and collect a new measurement. Refit models. Iterate.

**How It's Built**
- **Backend**: Node.js 22, no npm dependencies. Single server.mjs, ~300 LOC. Reads Nebius API key from environment, never logs it.
- **Frontend**: Vanilla JS + CSS Grid. Dark graphite theme (custom, not default). Workbench panels (Studio, Motion Lab, Coupling Lab), real-time fit updates, indexed notebook storage.
- **Science core**: Deterministic solvers (Levenberg-Marquardt fitting, pseudo-inverse). Nemotron proposes; app executes and checks. User decides.
- **Testing**: 380+ integration tests (Node.js --test), covering CSV import, model fitting, held-out validation, Nemotron adapter, curve fitting, and motion tracking.

**Challenges & Solutions**
- **Floating-point precision**: Fitted coefficients vary at machine epsilon. Round display values (e.g., 2.400000000000001 → 2.4) while retaining full precision internally.
- **Prompt engineering**: Training summary must be compact (≤40 rows sampled, field ranges) so Nemotron reads it quickly and stays focused on physics. Include the existing catalog so proposals don't invent new terms.
- **Validation**: Only accept JSON from Nemotron that contains known catalog IDs. Reject malformed, duplicated, or unknown terms. Never execute unvetted model output.
- **Responsiveness**: Fitting is CPU-bound; offload to Web Worker or limit batch size. Currently single-threaded on small datasets; scales to ~500 training rows.

**What's Next**
- Multi-turn iterative refinement with Nemotron feedback.
- Automated experiment design (information-theoretic probe selection).
- Physics transfer learning: test models on novel mechanisms to discover invariant structure.
- Mobile-friendly 3D visualization of discovered dynamics.
- Integration with real sensors (accelerometers, encoders, torque transducers).

---

**Test Coverage**: 380 integration tests, all passing. Nemotron adapter mocked in automated tests; live integration verified at least once per session with real Nebius Token Factory call.

**Submission Checklist**
- [x] Live Nemotron integration on Nebius Token Factory
- [x] MIT License
- [x] README with setup & Nemotron section
- [x] Distinct product design (not template)
- [x] Secret scan passed (no API keys in history)
- [x] Narrated demo video (≤2:30)
- [x] Honest SUBMISSION.md answers
- [x] Committed to branch ui/distinct-redesign
