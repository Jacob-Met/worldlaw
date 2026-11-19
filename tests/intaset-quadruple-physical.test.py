#!/usr/bin/env python3
"""Source-FREE native falsification of original quadruple-tank intake/solvers.

Every observation in this file is explicitly synthetic and never substituted
for the original source-restricted experimental score. The first actual source
fit happens ONLY after all preregistered scientific interfaces are in git.
"""
import io
import importlib.util
import json
from pathlib import Path
import sys
import unittest
import zipfile
import numpy as np
from openpyxl import Workbook

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"src"/"science"))
import quadruple_tank_hydraulics as hyd
spec=importlib.util.spec_from_file_location("original_intaset",ROOT/"experiments"/"intaset-quadruple-physical.py")
recv=importlib.util.module_from_spec(spec)
spec.loader.exec_module(recv)

def synthetic_segment(name,n=450,phase=.3):
    """Closed-form bounded four-state dynamics with two varying actuator axes."""
    time=np.arange(n,dtype=float)*0.1
    u=np.column_stack((1.7+.55*np.sin(time/3.+phase),2.0+.7*np.cos(time/4.+phase)))
    y=np.empty((n,4),dtype=float);y[0]=[4.2,3.6,2.8,2.5]
    for t in range(n-1):
        old=y[t]
        own=np.sqrt(np.maximum(old,0.))
        dy=np.array([
            -.07*own[0]+.025*own[2]+.030*u[t,0],
            -.06*own[1]+.020*own[3]+.026*u[t,1],
            -.08*own[2]+.020*u[t,1],
            -.075*own[3]+.018*u[t,0]
        ])
        y[t+1]=np.maximum(.001,old+dy*.1)
    return {"id":name,"u":u,"y":y,"time":time}

class OriginalQuadrupleTankTests(unittest.TestCase):
    def test_registered_source_contract_refuses_wrong_shape_duplicate_and_gap(self):
        seg=synthetic_segment("original-M1")
        self.assertEqual(hyd.validate_segment(seg)[0].shape,(450,2))
        with self.assertRaisesRegex(ValueError,"duplicate original source segment"):
            hyd.validate_segments([seg,seg])
        wrong={**seg,"y":seg["y"][:,:3]}
        with self.assertRaisesRegex(ValueError,"four sensor and two pump"):
            hyd.validate_segment(wrong)
        with self.assertRaisesRegex(ValueError,"128"):
            hyd.validate_segment({**seg,"id":"short","u":seg["u"][:64],"y":seg["y"][:64]})
        nonfinite={**seg,"y":seg["y"].copy()}
        nonfinite["y"][99,0]=np.nan
        with self.assertRaisesRegex(ValueError,"128\\+ contiguous finite"):
            hyd.validate_segment(nonfinite)

    def test_source_only_chronological_split_preserves_independent_segments(self):
        originals=[synthetic_segment("r1",450),synthetic_segment("r2",450,1.2)]
        train,dev,meta=recv.split_chronological(originals)
        self.assertEqual(meta["originalValidRows"],900)
        self.assertEqual(meta["originalCutoff"],630)
        self.assertEqual(meta["trainRows"],630)
        self.assertEqual(meta["devRows"],270)
        self.assertTrue(all("/train" in s["id"] for s in train))
        self.assertTrue(all("/development" in s["id"] for s in dev))
        self.assertFalse(set(s["id"] for s in train)&set(s["id"] for s in dev))
        self.assertAlmostEqual(train[0]["y"][0,0],originals[0]["y"][0,0])
        self.assertAlmostEqual(dev[-1]["y"][-1,0],originals[-1]["y"][-1,0])

    def test_linear_and_quadratic_original_models_are_causal_and_regularized(self):
        seg=synthetic_segment("m1",450)
        arx=hyd.fit_data_model([seg],4,1e-4,"arx")
        narx=hyd.fit_data_model([seg],2,1e-4,"narx")
        self.assertEqual(arx["order"],4)
        self.assertEqual(len(arx["coefficients"][0]),4)
        self.assertGreater(narx["features"],arx["features"]//2)
        self.assertTrue(np.all(np.isfinite(narx["coefficients"])))
        with self.assertRaisesRegex(ValueError,"preregistered ARX/NARX order"):
            hyd.fit_data_model([seg],32,1e-4,"arx")
        with self.assertRaisesRegex(ValueError,"preregistered ridge"):
            hyd.fit_data_model([seg],2,1e-3,"narx")
        predicted=hyd.forecast(arx,seg["u"],seg["y"][:64])
        tampered=seg["y"].copy()
        tampered[64:]+=999
        ident=hyd.forecast(arx,seg["u"],tampered[:64])
        self.assertTrue(np.array_equal(predicted,ident))
        shifted=hyd.forecast(arx,seg["u"],seg["y"][:64],shift=97)
        self.assertFalse(np.array_equal(predicted,shifted))
        bad_u=seg["u"].copy()
        bad_u[200,1]=float("nan")
        with self.assertRaisesRegex(ValueError,"finite two-pump"):
            hyd.forecast(arx,bad_u,seg["y"][:64])

    def test_multisensor_signed_physical_conservation_and_lagged_input_controls(self):
        seg=synthetic_segment("m2",330)
        model=hyd.fit_physical_model([seg],"coupled",1e-5)
        self.assertEqual(model["family"],"physical")
        self.assertEqual(len(model["coefficients"]),4)
        self.assertTrue(all(np.min(np.asarray(c)[:-1])>=-1e-9
                         for c in model["coefficients"]))
        self.assertTrue(all(np.isfinite(c).all() for c in model["coefficients"]))
        expected=hyd.forecast(model,seg["u"],seg["y"][:64])
        changed=seg["y"].copy();changed[64:]=10**5
        self.assertTrue(np.array_equal(expected,hyd.forecast(model,seg["u"],changed[:64])))
        self.assertFalse(np.array_equal(expected,hyd.forecast(model,seg["u"],seg["y"][:64],zero_input=True)))
        s=hyd.score_model(model,[seg],model["scale"])
        self.assertEqual(s["scoredSamples"],330-64)
        self.assertEqual(len(s["perTankRmseNative"]),4)
        self.assertEqual(s["horizonScores"]["30"]["samples"],30)
        self.assertTrue(np.isfinite(s["macroNormalizedRmse"]))

    def test_scoring_only_sees_future_measured_values_after_free_run(self):
        seg=synthetic_segment("sensor-swap",250)
        norm=hyd.train_scale([seg])
        persistence={"family":"persistence"}
        original=hyd.score_model(persistence,[seg],norm)
        changed_y=seg["y"].copy();changed_y[64:]+=11
        altered=hyd.score_model(persistence,[{**seg,"y":changed_y}],norm)
        self.assertNotEqual(original["macroNormalizedRmse"],altered["macroNormalizedRmse"])
        self.assertEqual(original["predictionHashes"],altered["predictionHashes"])
        swapped=hyd.score_model(persistence,[seg],norm,swap_tank12=True)
        self.assertNotEqual(original["macroNormalizedRmse"],swapped["macroNormalizedRmse"])
        self.assertEqual(original["scoredSamples"],swapped["scoredSamples"])

    def test_author_workbook_schema_original_roles_and_dropout_split_are_source_free(self):
        zdata=io.BytesIO()
        with zipfile.ZipFile(zdata,"w") as archive:
            for mode in ("4T-M1","4T-M2"):
                for role in ("train","test"):
                    file,sheet=recv.SOURCE_PATHS[mode][role]
                    wb=Workbook()
                    ws=wb.active
                    ws.title=sheet
                    ws.append(["Time"," - Tank 1"," - Tank 2"," - Tank 3",
                              " - Tank 4"," - Pump 1"," - Pump 2"])
                    for k in range(301):
                        # Force a genuine missing sensor at a specific row;
                        # no interpolation or averaging may bridge it.
                        ws.append([k*.1,1.+.001*k,2.+.002*k,
                                   None if k==150 else 3.+.003*k,
                                   4.+.004*k,1.+.01*k,2.+.012*k])
                    buf=io.BytesIO()
                    wb.save(buf)
                    archive.writestr(file,buf.getvalue())
        with zipfile.ZipFile(io.BytesIO(zdata.getvalue())) as z:
            measured,meta=recv.load_workbook_segments(z,"4T-M1","train")
            self.assertEqual(meta["nonfiniteOrMissingRows"],1)
            self.assertEqual(meta["originalRowsFollowingHeader"],301)
            self.assertEqual(meta["keptContiguousSegments"],2)
            self.assertEqual(meta["keptRows"],300)
            self.assertAlmostEqual(meta["medianOriginalTimeIntervalSeconds"],.1,places=8)
            self.assertTrue(all(len(s["y"])>=128 for s in measured))
            self.assertEqual(meta["sourceSheet"],"Training")
            source_test,mt=recv.load_workbook_segments(z,"4T-M2","test")
            self.assertEqual(mt["sourceSheet"],"Testing")
            self.assertEqual(len(source_test),2)
        with self.assertRaisesRegex(ValueError,"ZIP byte length"):
            recv.authenticate("/dev/null")

    def test_fitting_development_strong_reference_has_bounded_negatives(self):
        # Keep source-free full family integration small but nontrivial;
        # candidates are all registered and selection never views Test.
        train=[synthetic_segment("synthetic-estimation",210)]
        dev=[synthetic_segment("synthetic-development",150,1.3)]
        result=hyd.fit_select_original(train,dev)
        self.assertEqual(len(result["candidates"]),30)
        self.assertTrue(result["sourceOnlySelection"])
        self.assertIn(result["referenceType"],("arx","narx"))
        self.assertTrue(np.isfinite(result["referenceDevelopmentScore"]))
        self.assertIn("best_reference",result["selected"])
        self.assertIn("arx",result["selected"])
        self.assertIn("physical",result["selected"])
        noleak=hyd.score_model(result["selected"]["best_reference"],dev,result["trainingNormalization"])
        self.assertGreater(noleak["scoredSamples"],0)

if __name__=="__main__":
    unittest.main(verbosity=2)
