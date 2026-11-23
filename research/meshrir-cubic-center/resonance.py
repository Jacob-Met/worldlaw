"""Verify the rational enclosure that admits both standing waves at 3000 Hz."""
from fractions import Fraction as Q

h = Q(1,20)
c = Q(3473,10)
f = 3000
a = 4*f*h
assert a==600 and a*a<3*c*c<602**2
# cos(kh/sqrt(3)) = sin(pi/2 * (1 - 600/(sqrt(3)*c))).
# The positive sine is bounded by its argument and pi<22/7.
bound = Q(11,7)*(1-Q(600,602))
assert bound==Q(11,2107) and bound<Q(1,100)
print("Maximum absolute donor magnitude is at most",bound,
      "<1/100 for the center-one unit-angular-mass standing wave.")
