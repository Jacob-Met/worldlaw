import itertools
import unittest
import numpy as np
from score import basis, d_optimal, rounded, survivors


class CalibrationTests(unittest.TestCase):
    def test_closed_affine_feasibility_handles_equal_and_negative_differences(self):
        f = np.tile(np.array([0,10000,10000,4000])[:,None],(1,4))
        y = np.array([13,8013,8013,3213])
        self.assertEqual(len(survivors(y,f,[2,0,3,1],0)),4)
        self.assertEqual(survivors(y+np.array([0,0,1,0]),f,[0,1,2,3],0),[])

    def test_source_only_geometry_and_reciprocal_weight(self):
        c = np.asarray([[1,78],[-21,0],[33,-56],[45,45],[0,90],[33,0],[84,-22],[58,42],[65,-26],[72,14]])
        f = basis(c)
        self.assertEqual(d_optimal(f,4), d_optimal(f.copy(),4))
        self.assertEqual(len(set(d_optimal(f,4))),4)
        y = f[:,0]+5023
        self.assertEqual(survivors(y,f,list(range(10)),10),["relative"])
        self.assertEqual(rounded([-.11345,.11345]).tolist(),[-1134,1135])

if __name__=="__main__":
    unittest.main()
