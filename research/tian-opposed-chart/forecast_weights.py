"""Direction-conditioned shape forecasts in the frozen source-image basis."""
import numpy as np


BANDWIDTHS = (0.75, 1.5, 3.0, 6.0)
RIDGES = (0.003, 0.03, 0.3)


def gaussian(a, b, sigma):
    diff = a[:, None, :] - b[None, :, :]
    return np.exp(-np.sum(diff * diff, axis=2) / (2 * sigma**2))


def normalize(w, gram):
    sq = float(w @ gram @ w)
    return w / np.sqrt(sq) if sq > 1e-15 else np.zeros_like(w)


def shape_error(w, true_pos, gram):
    u = normalize(w, gram)
    return max(0.0, float(u @ gram @ u + gram[true_pos, true_pos] - 2 * u @ gram[:, true_pos]))


def kriging_inverse(xy, sigma, ridge):
    n = len(xy)
    a = np.ones((n + 1, n + 1))
    a[:n, :n] = gaussian(xy, xy, sigma) + ridge * np.eye(n)
    a[n, n] = 0
    return np.linalg.inv(a)


def ordinary_weights(xy, destinations, sigma, inverse):
    rhs = np.vstack((gaussian(xy, destinations, sigma), np.ones((1, len(destinations)))))
    return (inverse @ rhs)[:-1].T


def select_direct(positions, pairs, xy, gram):
    # The augmented inverse gives true single-target-out weights, including the unpenalized intercept.
    grid = []
    for sigma in BANDWIDTHS:
        for ridge in RIDGES:
            inv = kriging_inverse(xy, sigma, ridge)
            losses = []
            for pair in pairs:
                t = positions[pair['target']]
                w = -inv[:-1, t] / inv[t, t]
                w[t] = 0
                losses.append(shape_error(w, t, gram))
            grid.append((float(np.mean(losses)), sigma, ridge))
    return min(grid), grid


def displacement_basis(pairs, positions, xy):
    delta = np.zeros((len(pairs), len(xy)))
    cxy = []
    for j, p in enumerate(pairs):
        i, d = positions[p['target']], positions[p['donor']]
        cxy.append(xy[i])
        delta[j, i], delta[j, d] = 1, -1
    return np.asarray(cxy), delta


def odd_kernel(a, b, sigma):
    return gaussian(a, b, sigma) - gaussian(a, -b, sigma)


def odd_fits(pairs, positions, xy, gram, turn):
    cxy, delta = displacement_basis(pairs, positions, xy)
    rotate = np.array([[0., 1.], [-1., 0.]])
    cfit = cxy @ rotate if turn else cxy
    grid = []
    for sigma in BANDWIDTHS:
        for ridge in RIDGES:
            a = odd_kernel(cfit, cfit, sigma) + ridge * np.eye(len(pairs))
            inv = np.linalg.inv(a)
            losses = []
            for j, p in enumerate(pairs):
                # Remove the entire evaluated calibration pair from the correction, even for the rotated sham.
                k = odd_kernel(cfit, cxy[j:j+1], sigma)[:, 0]
                alpha = inv @ k
                alpha -= inv[:, j] * (alpha[j] / inv[j, j])
                alpha[j] = 0
                w = alpha @ delta
                w[positions[p['donor']]] += 1
                losses.append(shape_error(w, positions[p['target']], gram))
            grid.append((float(np.mean(losses)), sigma, ridge))
    return min(grid), grid


def odd_prediction(pairs, positions, xy, query_coord, donor_index, sigma, ridge, turn):
    cxy, delta = displacement_basis(pairs, positions, xy)
    if turn:
        cxy = cxy @ np.array([[0., 1.], [-1., 0.]])
    a = odd_kernel(cxy, cxy, sigma) + ridge * np.eye(len(cxy))
    k = odd_kernel(cxy, np.asarray([query_coord]), sigma)[:, 0]
    w = np.linalg.solve(a, k) @ delta
    w[donor_index] += 1
    return w


def simple(ids, xy, target, donor):
    t = np.asarray(target)
    n = len(ids)
    base = np.zeros(n)
    dd = np.sum((xy-t)**2, axis=1)
    r2 = np.sum(xy**2, axis=1)
    tr2 = t @ t
    other = [k for k in range(n) if k != donor]
    nearest = min(other, key=lambda k:(dd[k],ids[k]))
    shell = np.flatnonzero(r2 == tr2)
    other_shell = [k for k in other if r2[k] == tr2]
    radial = min(other_shell,key=lambda k:(dd[k],ids[k])) if other_shell else nearest
    answers={}
    for role, index in [('opposed',donor),('nearest-other',nearest),('nearest-same-shell-other',radial)]:
        w=base.copy();w[index]=1;answers[role]=w
    answers['global-average']=np.full(n,1/n)
    w=base.copy();w[shell]=1/len(shell);answers['shell-average']=w
    answers['zero-shape']=base.copy()
    return answers
