"""Reciprocal positive-resistance electrical two-port control, with loaded gains."""
from fractions import Fraction as F

def voltage_gain(z11,z12,z22,source,load):
    # Z21=Z12. The receiver measures voltage across the shunt load.
    denominator=(z11+source)*(z22+load)-z12*z12
    return load*z12/denominator

def checks():
    z1,z2,z12,rs,rl=map(F,[1,4,1,1,10])
    assert z1*z2>z12*z12
    v12=voltage_gain(z1,z12,z2,rs,rl)
    v21=voltage_gain(z2,z12,z1,rs,rl)
    assert v12==F(10,27) and v21==F(5,27)
    assert voltage_gain(z1,z12,z2,rs,rs)==voltage_gain(z2,z12,z1,rs,rs)
    # Manufacturer or in-water port impedances have not been assumed for the actual experiment.
    return {'symmetric_passive_Z':[[int(z1),int(z12)],[int(z12),int(z2)]],
            'source_and_load':[int(rs),int(rl)],'loaded_gain_ratio':str(v12/v21),
            'squared_voltage_ratio':str((v12/v21)**2),'scientific_observations':0}

if __name__=='__main__':print(checks())
