"""Source-free exact invariants for the official Cascaded Tanks physical benchmark.

No official measured values are touched here. Synthetic models exercise causal
forecast controls, sealed variable loading and the nonlinear hidden-state path.
"""
from __future__ import annotations
import importlib.util
from io import BytesIO
from pathlib import Path
import sys
import unittest
import numpy as np
from scipy.io import savemat

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"/"science"))
import controlled_hydraulics as hyd
spec=importlib.util.spec_from_file_location("cascaded_original",ROOT/"experiments"/"cascaded-tanks-physical.py")
receiver=importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)

def original_synthetic(n=240,offset=0):
    k=np.arange(n,dtype=float)
    u=.35+.3*np.sin(k/17.+offset)+.12*np.cos(k/29.-offset)
    coefficients=[.12,.17,.13,0.,2.2]
    y=hyd.integrate_physical(u,coefficients,"no_overflow",observed_y0=1.6)
    return u,y

class ControlledHydraulicsTests(unittest.TestCase):
    def test_unobserved_future_measurements_never_affect_arx_forecast(self):
        u,y=original_synthetic()
        model=hyd.fit_arx(u[:150],y[:150],4,1e-4)
        a=hyd.free_run(model,u,y)
        changed=y.copy()
        changed[50:]+=5.
        b=hyd.free_run(model,u,changed)
        self.assertTrue(np.array_equal(a["prediction"],b["prediction"]))
        self.assertNotEqual(a["rmse"],b["rmse"])
        shifted=hyd.free_run(model,u,y,shift=97)
        self.assertTrue(np.isfinite(shifted["rmse"]))
    def test_arx_training_no_future_and_only_registered_hyperparameters(self):
        u,y=original_synthetic()
        with self.assertRaisesRegex(ValueError,"unregistered ARX order"):
            hyd.fit_arx(u,y,9,1e-4)
        with self.assertRaisesRegex(ValueError,"unregistered ridge"):
            hyd.fit_arx(u,y,4,0.123)
        model=hyd.fit_arx(u[:160],y[:160],4,1e-4)
        self.assertEqual(model["order"],4)
        self.assertEqual(model["trained_rows"],156)
        self.assertEqual(len(model["coefs"]),9)
    def test_signed_hydraulic_state_and_overflow_are_bounded(self):
        u,y=original_synthetic()
        p=[.12,.17,.13,-.1,2.2,2.8,1.5]
        pred=hyd.integrate_physical(u,p,"hard_overflow",observed_y0=1.)
        self.assertTrue(np.all(np.isfinite(pred)))
        self.assertLessEqual(float(np.max(pred)),1.5-.1+1e-12)
        self.assertGreaterEqual(float(np.min(pred)),-.1-1e-12)
    def test_physical_prefix_calibration_excludes_future_observations(self):
        u,y=original_synthetic(180)
        model={"family":"hydraulic","variant":"no_overflow",
               "parameters":[.12,.17,.13,0.,2.2],"converged":True}
        a=hyd.free_run(model,u,y)
        z=y.copy()
        z[50:]+=10.
        b=hyd.free_run(model,u,z)
        self.assertTrue(np.array_equal(a["prediction"],b["prediction"]))
        self.assertNotEqual(a["rmse"],b["rmse"])
        self.assertEqual(a["calibration"]["prefix_count"],50)
    def test_fitting_known_hydraulics_is_finite_and_positive(self):
        u,y=original_synthetic(130)
        model=hyd.fit_physical(u,y,"no_overflow",max_nfev=25)
        self.assertEqual(model["family"],"hydraulic")
        self.assertTrue(np.all(np.isfinite(model["parameters"])))
        self.assertTrue(np.all(np.asarray(model["parameters"][:3])>=0))
        self.assertLess(model["train_rmse"],2.)
    def test_official_test_variable_names_hidden_even_if_changed(self):
        u,y=original_synthetic(1024)
        u2,y2=original_synthetic(1024,offset=1.4)
        def encode(y_test):
            buffer=BytesIO()
            savemat(buffer,{"uEst":u[:,None],"yEst":y[:,None],
                "uVal":u2[:,None],"yVal":y_test[:,None],"Ts":np.array([[4.]])})
            return buffer.getvalue()
        a=receiver.load_named_original(encode(y2),"fit")
        b=receiver.load_named_original(encode(y2+100),"fit")
        self.assertTrue(np.array_equal(a[0],b[0]))
        self.assertTrue(np.array_equal(a[1],b[1]))
        self.assertEqual(a[2],4.)
        changed=receiver.load_named_original(encode(y2+100),"evaluate")
        self.assertTrue(np.array_equal(changed[1],y2+100))
    def test_source_archive_pin_and_source_field_refusals(self):
        with self.assertRaisesRegex(ValueError,"source archive size changed"):
            receiver.authenticate.__wrapped__(b"bad") if hasattr(receiver.authenticate,"__wrapped__") else receiver.authenticate.__call__("/dev/null")
        with self.assertRaisesRegex(ValueError,"official 50 sample prefix policy"):
            u,y=original_synthetic()
            hyd.free_run({"family":"persistence"},u,y,init=49)

if __name__=="__main__":
    unittest.main(verbosity=2)
