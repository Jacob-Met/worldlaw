# Prepared retained periodic evaluation

The original periodic model, coordinate bounds and scalar dynamics remain unchanged. Each immutable prepared evaluator now computes the original anchor sine/cosine and the transformed periodic coefficient pairs once. Every later call evaluates one bounded displacement series, retaining sin(delta) and cos(delta)−1 separately. This avoids repeated anchor reductions and half-angle evaluations, while preserving the cancellation-sensitive original force, derivative and residual.

The displacement domain remains |delta|≤1. Fourteen sine/cosine recurrence terms suffice for this explicitly bounded domain: the next cosine term is at most1/30!<3.8e−33; the omitted sine term is smaller. This is below the measured pair arithmetic floor after admitted coefficients. Original anchor reduction retains its existing eighteen terms and one-million-radian bound. This truncation estimate is not a floating-point interval certificate.

## Complete work

The direct executor reserves two immutable preparations at32768 scalar work units each, plus8192 for every permitted native derivative call, both output passes and the explicit initial-point admission. The original-source wrapper adds the existing ordinary comparison allowance and complete fitting/source evaluation before its unchanged250M gate.

A pair multiply uses at most110 scalar arithmetic operations, division by a small integer50 and pair addition14. Fourteen displacement iterations require4984 operations; the initial square, final cosine and mapped affine/periodic/derivative/ordinary computations remain below8192 per point. The preparation allowance covers anchor reduction, original coefficient mapping and existing admission. These counters exclude allocations, wall time and browser rendering.

## Evidence and limits

The previous and prepared evaluators were checked on140 admitted original-input cases and one common original-domain refusal. Independent Decimal120 checks retained maximum observed response/derivative error below7.04e−19. A separate reviewer checked31 split-coefficient cases with Decimal110, including tiny coefficient low parts. One owner timing run over10000 points measured371ms before and61ms after; this is local throughput evidence, not a universal benchmark.

An original500rad/s response over0.5s, with an explicit0.0005s display interval and2000-trial allowance, previously refused complete work. The prepared source course refits and executes1964 native trials within229,710,373 reserved units. Against an independent Decimal120 trajectory of the freshly fitted coefficient pairs, final displacement error was1.41e−16rad and rate error5.04e−13rad/s. The rate error exceeds the declared1e−14 local tolerance: local estimates are not global trajectory guarantees.

Other longer coarse-output courses also execute, but retain larger accumulated phase errors. Two finer-output unfamiliar courses exhaust2000 trials and return no partial prediction. These failures are preserved. Preparing an evaluator changes the affordable computation; it does not certify motion accuracy, physical identification or global convergence. Original-only source replay, selected-law isolation and existing unsupported-structure refusals remain unchanged.
