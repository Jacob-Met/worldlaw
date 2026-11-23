# Exact observable equivalence of the published minimal two-level model

Agarwal and colleagues use a qubit coupled to a second two-level system (TLS). For their minimal model, a classical random detuning gives exactly the same probabilities for every operation that acts on the qubit alone. This is a property of the specified generator, independent of experimental counts or parameter estimates.

## Source convention

Equations 15–19 define the Lindblad dissipator D[A]ρ=AρA†−{A†A,ρ}/2, an arbitrary time-dependent ideal qubit drive plus a Z detuning, qubit amplitude damping through |0⟩⟨1|, and qubit dephasing through Z. Equation 22 adds ν Z⊗X, with Pauli X on the TLS, and extends qubit jumps by the identity. The accompanying text adds κD[I⊗|0⟩⟨1|]. The stated initial qubit/TLS product is |+⟩⊗|0⟩. SPAM errors, higher qubit levels and pulse-shape details are omitted in the authors’ numerical fits. The theorem below actually allows any specified qubit drive as a function of time and any qubit-only Lindblad dissipator. [Primary paper, Sections II.C and Appendices D–E](https://arxiv.org/pdf/2306.13021)

## Reduction

Let ρ be any joint density matrix. Define S=Tr_TLS ρ, D=Tr_TLS[(I⊗X)ρ], and R±=(S±D)/2=⟨±x|ρ|±x⟩. R± are positive by compression of a positive operator. Their traces are probabilities summing to one. Initial system–environment correlations can give different conditional qubit states in the two blocks. For the authors’ initial state the sign probabilities equal one half and the conditional qubit states coincide.

Write Lq for the complete qubit generator, including the qubit drive and errors. Since X²=I, the coupling contributes −iν[Z,D] to S′ and −iν[Z,S] to D′. The adjoint TLS amplitude-damping dissipator leaves I unchanged under time evolution and gives D†[|0⟩⟨1|](X)=−X/2. Thus

    S′ = Lq(S) − iν[Z,D]
    D′ = Lq(D) − iν[Z,S] − κD/2
    R±′ = Lq(R±) − i[±νZ,R±] + (κ/4)(R∓−R±).

The last pair is a classical symmetric two-state jump process superposed on qubit dynamics. The sign flips at rate κ/4 *in each direction*, giving correlation decay κ/2. Setting κ=0 gives static detuning choices. Keeping κ>0 permits switching during the applied sequence, including during arbitrary time-dependent qubit drives.

For any selected qubit-only instrument map E_a, the unnormalized blocks become E_a(R±). Their trace sum p(a) is the outcome probability. When p(a)>0 the normalized posterior blocks are E_a(R±)/p(a). The zero-probability branch contributes no record. Iteration proves equality of all qubit-only outcome records and qubit-only controls chosen from earlier outcomes, with the same initial blocks, measurement rules and controls on each side. This compares observable statistics of the minimal model. It does not assert that any particular hardware environment is classical or quantum, nor does it reconstruct arbitrary initial joint coherences.

## Scope and direct verification

An additional free TLS term proportional to Z, a noncommuting coupling, access to the TLS, or a joint measurement can break this reduction. For example an I⊗Z term sends X to a multiple of Y in the adjoint equation; S and D need not close. The authors discuss richer models separately. Parameters or Hamiltonian terms from those models are outside this identity. Other classical models may remain possible even where this specific reduction fails.

The independent executable implements the full 4×4 joint generator, direct X-basis compression, and a separate two-sign switching generator. It compares all 16 complex joint matrix units for five sample qubit controls, two interaction strengths, two TLS damping strengths and both signs. All 640 generator blocks and 160 selected-instrument blocks agree exactly for the dyadic fixture. An entangled Bell initial state gives different positive conditional blocks of trace one half. An intentionally doubled flip rate yields a maximum component mismatch of 0.125. Adding only the noncommuting TLS-Z fixture yields 0.25. These values have synthetic generator units. The algebra establishes generality beyond the finite oracle.

The physical depth-extrapolation study is a separate test. Identical predictions at matched parameters must be counted as one model family. Neither a forecast win nor departure from a stationary single-qubit recurrence distinguishes these two matched mechanisms.
