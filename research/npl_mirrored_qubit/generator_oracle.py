"""Independent basis test for the NPL minimal driven qubit–TLS generator."""
import json


def matrix(n, fn):
    return [[fn(i, j) for j in range(n)] for i in range(n)]


def product(a, b):
    return matrix(len(a), lambda i, j: sum(a[i][k]*b[k][j] for k in range(len(a))))


def combine(*terms):
    return matrix(len(terms[0][1]), lambda i, j: sum(c*a[i][j] for c, a in terms))


def dagger(a):
    return matrix(len(a), lambda i, j: a[j][i].conjugate())


def kron(a, b):
    n = len(b)
    return matrix(len(a)*n, lambda i, j: a[i//n][j//n]*b[i%n][j%n])


def commutator(h, r):
    return combine((-1j, product(h, r)), (1j, product(r, h)))


def sandwich(k, r):
    return product(product(k, r), dagger(k))


def dissipator(jump, r):
    jj = product(dagger(jump), jump)
    return combine((1, sandwich(jump, r)), (-0.5, product(jj, r)), (-0.5, product(r, jj)))


identity = [[1, 0], [0, 1]]
x = [[0, 1], [1, 0]]
y = [[0, -1j], [1j, 0]]
z = [[1, 0], [0, -1]]
lower = [[0, 1], [0, 0]]
zero = [[0, 0], [0, 0]]


def condition(r, sign):
    # <+x|r|+x> or <-x|r|-x> on the second (environment) tensor factor.
    return matrix(2, lambda i, j: 0.5*(r[2*i][2*j]+r[2*i+1][2*j+1]
                                      +sign*(r[2*i+1][2*j]+r[2*i][2*j+1])))


def quantum_generator(r, h, nu, kappa, tls_z=0):
    h4 = combine((1, kron(h, identity)), (nu, kron(z, x)), (tls_z, kron(identity, z)))
    return combine((1, commutator(h4, r)), (0.125, dissipator(kron(lower, identity), r)),
                   (0.0625, dissipator(kron(z, identity), r)),
                   (kappa, dissipator(kron(identity, lower), r)))


def telegraph_generator(r, other, sign, h, nu, kappa, flip_fraction=0.25):
    return combine((1, commutator(combine((1, h), (sign*nu, z)), r)),
                   (0.125, dissipator(lower, r)), (0.0625, dissipator(z, r)),
                   (kappa*flip_fraction, other), (-kappa*flip_fraction, r))


def distance(a, b):
    return max(abs(a[i][j]-b[i][j]) for i in range(len(a)) for j in range(len(a)))


def entry(n, i, j):
    return matrix(n, lambda row, col: int((row, col) == (i, j)))


def instrument(r, ops):
    return combine(*[(1, sandwich(op, r)) for op in ops])


def run():
    worst = wrong_rate = noncommuting = update_worst = 0.0
    generators = instrument_elements = 0
    # Complex matrix units span all correlated initial operators, including non-Hermitian ones.
    for i in range(4):
        for j in range(4):
            r = entry(4, i, j)
            for h in [zero, x, y, z, combine((1,x),(-0.5,y),(0.25,z))]:
                for nu in [0, 0.375]:
                    for kappa in [0, 0.5]:
                        q = quantum_generator(r,h,nu,kappa)
                        extra = quantum_generator(r,h,nu,kappa,tls_z=0.25)
                        for sign in [-1, 1]:
                            a, b = condition(r,sign), condition(r,-sign)
                            t = telegraph_generator(a,b,sign,h,nu,kappa)
                            worst = max(worst, distance(condition(q,sign),t))
                            wrong = telegraph_generator(a,b,sign,h,nu,kappa,flip_fraction=0.5)
                            wrong_rate = max(wrong_rate, distance(condition(q,sign),wrong))
                            noncommuting = max(noncommuting, distance(condition(extra,sign),t))
                            generators += 1
            # Unnormalized maps include a selected outcome, hence also allow feedforward.
            for ops in [[entry(2,0,0)], [entry(2,1,1)], [lower], [x], [entry(2,0,0),lower]]:
                updated = instrument(r, [kron(k, identity) for k in ops])
                for sign in [-1,1]:
                    update_worst = max(update_worst, distance(condition(updated,sign),instrument(condition(r,sign),ops)))
                    instrument_elements += 1
    # Entangled Bell state: the conditional qubit states differ. Their traces sum to one.
    bell = matrix(4, lambda i,j: 0.5 if i in [0,3] and j in [0,3] else 0)
    assert condition(bell,1) == [[0.25,0.25],[0.25,0.25]]
    assert condition(bell,-1) == [[0.25,-0.25],[-0.25,0.25]]
    assert worst == update_worst == 0 and wrong_rate > 0 and noncommuting > 0
    return dict(generator_block_comparisons=generators,generator_max_error=worst,
                instrument_block_comparisons=instrument_elements,instrument_max_error=update_worst,
                incorrect_flip_rate_max_error=wrong_rate,additional_noncommuting_tls_z_max_error=noncommuting,
                correlated_bell_initial_block_traces=[0.5,0.5],data_accessed=False)


if __name__ == "__main__":
    print(json.dumps(run(),sort_keys=True))
