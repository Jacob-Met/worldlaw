"""Forecast lag differences from two authenticated parent suspensions."""
import math

import numpy as np

from data import anchored


EXPECTED_SMALL = {.0002: .99, .001: .95, .005: .77, .01: .63, .025: .40,
                  .05: .25, .10: .13, .25: .05, .50: .02, .70: .01}


def blend(p, curves):
    return (1-p) * curves[0] + p * curves[1]


def optical_coordinate(p):
    return 58*p/(1-p+58*p)


def sphere_form(z):
    return 3*(np.sin(z) - z*np.cos(z))/z**3


class Forecast:
    def __init__(self, q, t, bins, fits, measurements):
        self.q, self.t, self.y = q, t, measurements
        self.bands = [np.flatnonzero((bins >= a) & (bins <= b))
                      for a, b in ((36, 46), (47, 58), (59, 70))]
        self.empirical = np.stack([measurements[p].mean(0) for p in (0., 1.)])
        self.amplitude = np.stack([np.mean([f["A"] for f in group], axis=0) for group in fits])
        x = q[:, None]**2 * t[None, :]
        single, cumulant, contin = [], [], []
        for group in fits:
            curves, third_order, spectra = [], [], []
            for f in group:
                a = f["A"][:, None]
                curves.append(anchored(a * -np.expm1(-f["D"]*x)))
                mean, variance, moment3 = f["cumulants"]
                third_order.append(anchored(f["Ac"][:, None] * -np.expm1(
                    -mean*x + variance*x*x/2 - moment3*x**3/6)))
                # Appendix E specifies that these discrete peak weights sum directly.
                fraction = np.einsum("i,iqt->qt", f["weights"],
                                     -np.expm1(-f["grid"][:, None, None]*x))
                spectra.append(anchored(a * fraction))
            single.append(np.mean(curves, axis=0))
            cumulant.append(np.mean(third_order, axis=0))
            contin.append(np.mean(spectra, axis=0))
        self.single = np.stack(single)
        self.cumulant = np.stack(cumulant)
        self.contin = np.stack(contin)
        self.cross = np.zeros_like(self.single[0])
        for small in fits[0]:
            for large in fits[1]:
                ds, dl = small["D"], large["D"]
                weight = 2 * math.sqrt(ds*dl)/(ds+dl)
                amplitude = np.sqrt(small["A"]*large["A"])[:, None]
                decay = 2 - np.exp(-ds*x) - np.exp(-dl*x)
                self.cross += anchored(weight * amplitude * decay)/25

    def scale(self, p):
        return blend(p, self.amplitude)[:, None]

    def composition_shape(self, p, small_weight):
        w = np.broadcast_to(small_weight, self.q.shape)[:, None]
        shape = self.single / self.amplitude[:, :, None]
        return self.scale(p)*(w*shape[0] + (1-w)*shape[1])

    def interpolate(self, p, training, optical):
        anchors = sorted([0., 1., *training])
        low = max(a for a in anchors if a < p)
        high = min(a for a in anchors if a > p)
        left, right = self.y[low].mean(0), self.y[high].mean(0)
        if optical:
            fraction = ((optical_coordinate(p)-optical_coordinate(low)) /
                        (optical_coordinate(high)-optical_coordinate(low)))
            return self.scale(p)*((1-fraction)*left/self.scale(low) +
                                  fraction*right/self.scale(high))
        fraction = (p-low)/(high-low)
        return (1-fraction)*left + fraction*right

    def predict(self, p, training):
        if p in training:
            raise ValueError("Scored preparation also appears in calibration")
        ratio = (1.1/.24)**3 * (sphere_form(self.q*.55)/sphere_form(self.q*.12))**2
        base = blend(p, self.single)
        curves = {
            "pure_empirical": blend(p, self.empirical),
            "pure_author_LS": base,
            "pure_author_cumulant3": blend(p, self.cumulant),
            "pure_author_CONTIN": blend(p, self.contin),
            "author_Table1": self.composition_shape(p, EXPECTED_SMALL[p]),
            "nominal_formfactor": self.composition_shape(p, (1-p)/(1-p+p*ratio)),
            "interpolate_raw": self.interpolate(p, training, False),
            "interpolate_optical": self.interpolate(p, training, True),
        }
        design, measured = [], []
        for a in training:
            design.append((blend(a, self.single)/self.scale(a))[:, 1:].ravel())
            measured.append((self.y[a].mean(0)/self.scale(a))[:, 1:].ravel())
        x, y = np.hstack(design), np.hstack(measured)
        gain = max(0., (x @ y)/(x @ x))
        curves["global_gain_LS"] = gain*base

        # Each of the three coefficients is a correlation of the Brownian
        # noises driving two stationary OU components in one Fourier band.
        candidate = base.copy()
        two_gain = base.copy()
        correlations = []
        for band in self.bands:
            x, y, columns, target = [], [], [], []
            for a in training:
                scale = self.scale(a)[band]
                obs = self.y[a].mean(0)[band]
                x.append((math.sqrt(a*(1-a))*self.cross[band]/scale)[:, 1:].ravel())
                y.append(((obs-blend(a, self.single)[band])/scale)[:, 1:].ravel())
                columns.append(np.vstack([((1-a)*self.single[0, band]/scale)[:, 1:].ravel(),
                                          (a*self.single[1, band]/scale)[:, 1:].ravel()]).T)
                target.append((obs/scale)[:, 1:].ravel())
            x, y = np.hstack(x), np.hstack(y)
            rho = float(np.clip((x @ y)/(x @ x), -1, 1))
            correlations.append(rho)
            candidate[band] += rho*math.sqrt(p*(1-p))*self.cross[band]

            # Exact nonnegative least squares in two variables. Compare the
            # interior solution with each of the two possible boundary faces.
            m, obs = np.vstack(columns), np.hstack(target)
            unconstrained = np.linalg.lstsq(m, obs, rcond=None)[0]
            choices = [np.maximum(unconstrained, 0.)]
            for j in (0, 1):
                coeff = np.zeros(2)
                coeff[j] = max(0., (m[:, j] @ obs)/(m[:, j] @ m[:, j]))
                choices.append(coeff)
            coeff = min(choices, key=lambda c: np.sum((m @ c - obs)**2))
            two_gain[band] = ((1-p)*coeff[0]*self.single[0, band] +
                              p*coeff[1]*self.single[1, band])
        curves["OU_cross_covariance"] = candidate
        curves["two_gain_LS"] = two_gain

        anchors = [0., *training, 1.]
        coord = np.array([optical_coordinate(a) for a in anchors])
        kernel = np.exp(-.5*((coord[:, None]-coord[None, :])/.25)**2)
        residuals = np.stack([(self.y[a].mean(0)-blend(a, self.single))/self.scale(a)
                              for a in anchors])
        weights = np.linalg.solve(kernel + .05*np.eye(len(anchors)),
                                  np.exp(-.5*((coord-optical_coordinate(p))/.25)**2))
        curves["optical_RBF"] = base + self.scale(p)*np.einsum("i,iqt->qt", weights, residuals)
        return curves, correlations
