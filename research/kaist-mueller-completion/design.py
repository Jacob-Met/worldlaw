"""Frozen KAIST optical geometry panel; array axis order follows the author TensorFile."""
import itertools
import numpy as np

TRAIN_GROUPS = {
    "billiards": (2,4,8,9,10),
    "metallic_labels": (3,5,6,7,18),
    "ceramic_and_pearl_labels": (11,12,14)
}
HOLD_GROUPS = {"silicones":(13,15,16,19,20,22,23,24,25),"other_polymer_and_reference":(1,17,21)}
# The ±pi seam has a duplicate endpoint. Include the first canonically and
# list, but never count, the duplicate final endpoint. Include normal/grazing limits.
PHI=(0,30,60,90,120,150,180,210,240,270,300,330)
DIFF=(0,5,15,30,45,60,75,90)
HALF=(0,10,25,40,55,70,85,90)
WAVE=(450,500,550,600,650)
ABC_INDEX=tuple(itertools.product(PHI,DIFF,HALF))
GEOM=np.array([(*abc,j) for abc in ABC_INDEX for j in range(5)],np.int16)
