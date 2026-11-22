import numpy as np


def unit_vectors(x):
    x = np.asarray(x, dtype=np.complex128)
    scale = np.max(np.abs(x), axis=-1, keepdims=True)
    stable = np.divide(x, scale, out=np.zeros_like(x), where=scale != 0)
    norm = np.sqrt(np.sum(np.abs(stable) ** 2, axis=-1, keepdims=True))
    return np.divide(stable, norm, out=np.zeros_like(x), where=norm != 0), norm[..., 0] != 0


def projective_loss(observed, predicted):
    truth, identifiable = unit_vectors(observed)
    estimate, supported = unit_vectors(predicted)
    determinant = truth[..., 0] * estimate[..., 1] - truth[..., 1] * estimate[..., 0]
    errors = np.minimum(1.0, np.abs(determinant) ** 2)
    return np.where(identifiable, np.where(supported, errors, 1.0), np.nan)


def synthetic_controls():
    reference = np.array([[1., 2j], [1., 0.], [0., 1.], [0., 0.]])
    common = projective_loss(reference, reference * (1.3 - 2.1j))
    assert np.nanmax(common) < 1e-28 and np.isnan(common[-1])
    assert np.array_equal(projective_loss(reference[1:3], reference[[2, 1]]), [1., 1.])
    assert np.array_equal(projective_loss(reference[1:3], np.zeros((2, 2))), [1., 1.])
    assert projective_loss(reference[:1], reference[:1] * [1., -1.])[0] > 0.6
    spectrum = lambda x: np.dot(x, (-1j) ** np.arange(len(x)))
    channels = [[1., 0.], [0., 1.]]
    original = np.array(list(map(spectrum, channels)))
    convolved = [np.convolve(h, [1., 1.]) for h in channels]
    full = np.array(list(map(spectrum, convolved)))
    cropped = np.array([spectrum(h[:2]) for h in convolved])
    assert projective_loss(original, full) < 1e-28
    assert np.isclose(projective_loss(original, cropped), 1/6)
    return float(projective_loss(original, cropped))


if __name__ == '__main__':
    print(synthetic_controls())
