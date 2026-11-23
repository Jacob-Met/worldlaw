"""Three-shell linear filter using a finite directional minimax and a smoothness bound."""
import itertools
import numpy as np
from scipy.optimize import linprog
from scipy.special import spherical_jn

SHELL_SIZE = np.array([6,12,8])
PITCH = 0.05
SPEED = 347.3
FREQUENCIES = np.array([375,750,1500,2250,3000,3750,4500])
DEGREES = ((0,1),(1,2),(0,2))


def shell_responses(frequency, intervals):
    angle = np.linspace(0.0,np.pi/2,intervals+1)
    theta,phi = np.meshgrid(angle,angle,indexing="ij")
    direction = np.stack((np.sin(theta)*np.cos(phi), np.sin(theta)*np.sin(phi),np.cos(theta)),axis=-1).reshape(-1,3)
    c = np.cos((2*np.pi*frequency*PITCH/SPEED)*direction)
    responses = np.column_stack((c.mean(axis=1),sum(c[:,i]*c[:,j] for i,j in DEGREES)/3.0,c.prod(axis=1)))
    return responses


def minimax(frequency):
    # Real, shared orbit weights suffice by the symmetries of the closed cube,
    # conjugation and convexity of the maximum directional error.
    A = shell_responses(frequency,64)
    n = A.shape[0]
    Z = np.zeros((n,3))
    one = np.ones((n,1))
    B = np.vstack((np.hstack((A, Z, -one)), np.hstack((-A, Z, -one)),
                   np.hstack((np.eye(3), -np.eye(3),np.zeros((3,1)))),
                   np.hstack((-np.eye(3), -np.eye(3),np.zeros((3,1))))))
    b = np.r_[np.ones(n), -np.ones(n), np.zeros(6)]
    result = linprog([0,0,0,0.01,0.01,0.01,1],A_ub=B,b_ub=b,
                     bounds=[(None,None)]*3+[(0,None)]*4,method="highs")
    if not result.success:
        raise RuntimeError(result.message)
    w=result.x[:3]
    # A sampled maximum plus the interpolation theorem's two coordinate errors.
    M = 192
    sampled=np.max(np.abs(1-shell_responses(frequency,M)@w))
    ar=(2*np.pi*frequency*PITCH/SPEED)*np.sqrt([1,2,3])
    remainder=(np.pi/(2*M))**2*np.dot(np.abs(w),ar**2+ar)/4
    return w, dict(sampled_max=float(sampled),angular_remainder=float(remainder),
                   upper_from_numeric_samples=float(sampled+remainder),
                   norm1=float(np.abs(w).sum()), training_grid_objective=float(result.fun))


def radial_mean(frequency):
    kernel=spherical_jn(0,2*np.pi*frequency*PITCH/SPEED*np.sqrt([1,2,3]))
    denominator=np.dot(SHELL_SIZE,kernel**2)
    if denominator < 1e-10:
        raise ValueError("Unqualified radial mean denominator")
    return SHELL_SIZE*kernel/denominator
